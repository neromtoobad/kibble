import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import { nyseSession } from '@/lib/session';
import { pricesFor } from '@/lib/quote';

// Ranked by real, unrealised P&L: quantity and cost basis come from the database, and the live
// price per ticker is applied here. Nothing in the ranking is self-reported.

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ rows: [], pulse: null, cloud: false });

  try {
    await ensureSchema();
    const { rows } = await pool().query<{
      id: string; name: string; species: string; ticker: string; personality: string;
      streak: number; paper: boolean; is_public: boolean;
      qty: string; entry: string; margin: string; realized: string; funding_paid: string; faints: number;
    }>(
      `select p.id, p.name, p.species, p.ticker, p.personality, p.streak, p.paper,
              (p.published is not null) as is_public,
              coalesce((p.position->>'qty')::numeric, 0)   as qty,
              coalesce((p.position->>'entry')::numeric, 0) as entry,
              p.margin, p.realized, p.funding_paid, p.faints
         from pets p
        order by p.updated_at desc
        limit 100`,
    );

    // Proof the pets act on their own: how much happened in the last day, and how much of it
    // happened while the NYSE was shut and nobody could have pressed a button.
    const acts = await pool().query<{ ts: Date }>(
      `select ts from pet_entries
        where ts > now() - interval '24 hours' and kind in ('open','add','trim','flatten','liquidated','ask')
        order by ts desc limit 1000`,
    );
    const pulse = {
      actions: acts.rows.length,
      afterHours: acts.rows.filter((a) => nyseSession(a.ts) !== 'regular').length,
    };

    const prices = await pricesFor(rows.map((r) => r.ticker));

    const ranked = rows
      .map((r) => {
        const px = prices[r.ticker] ?? null;
        const qty = Number(r.qty) || 0;
        const entry = Number(r.entry) || 0;
        const margin = Number(r.margin) || 0;
        const basis = qty * entry;
        // A perpetual is marked on equity — margin plus what the position is up or down —
        // and measured against what the owner actually fed in.
        const unreal = px && qty ? qty * (px - entry) : 0;
        const value = px ? margin + unreal : null;
        return {
          id: r.id, name: r.name, species: r.species, ticker: r.ticker, personality: r.personality,
          streak: r.streak, paper: r.paper, isPublic: r.is_public,
          qty, basis, value, price: px, margin,
          lever: px && value ? (qty * px) / value : 0,
          fundingPaid: Number(r.funding_paid) || 0,
          faints: r.faints || 0,
          pnlAbs: unreal, pnlPct: basis > 0 ? (unreal / basis) * 100 : null,
        };
      })
      .filter((r) => r.margin > 0 || r.qty > 0)
      .sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));

    return NextResponse.json({ rows: ranked, pulse, cloud: true }, { headers: { 'Cache-Control': 's-maxage=30' } });
  } catch {
    return NextResponse.json({ rows: [], pulse: null, cloud: false });
  }
}
