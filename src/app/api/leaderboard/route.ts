import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import { nyseSession } from '@/lib/session';
import { pricesFor } from '@/lib/quote';

// Ranked by return since the first hourly mark — the number /api/metrics, the Proof page and every
// share card use — with equity marked at the live price. Quantity, cost basis and the starting mark
// come from the database; nothing in the ranking is self-reported. Unrealised P&L on the position
// the pet holds right now is still reported alongside, as `pnlPct`.

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ rows: [], pulse: null, cloud: false });

  try {
    await ensureSchema();
    const { rows } = await pool().query<{
      id: string; name: string; species: string; ticker: string; personality: string;
      streak: number; paper: boolean; is_public: boolean; execution: string;
      qty: string; entry: string; margin: string; realized: string; funding_paid: string; faints: number;
      start_equity: string | null; last_equity: string | null;
    }>(
      `select p.id, p.name, p.species, p.ticker, p.personality, p.streak, p.paper, p.execution,
              (p.published is not null) as is_public,
              coalesce((p.position->>'qty')::numeric, 0)   as qty,
              coalesce((p.position->>'entry')::numeric, 0) as entry,
              p.margin, p.realized, p.funding_paid, p.faints,
              (p.marks->0->>1)::numeric  as start_equity,
              (p.marks->-1->>1)::numeric as last_equity
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
        const start = Number(r.start_equity) || 0;
        return {
          id: r.id, name: r.name, species: r.species, ticker: r.ticker, personality: r.personality,
          streak: r.streak, paper: r.paper, execution: r.execution, isPublic: r.is_public,
          qty, basis, value, price: px, margin,
          lever: px && value ? (qty * px) / value : 0,
          fundingPaid: Number(r.funding_paid) || 0,
          faints: r.faints || 0,
          pnlAbs: unreal, pnlPct: basis > 0 ? (unreal / basis) * 100 : null,
          returnPct: start > 0 ? (((value ?? Number(r.last_equity)) - start) / start) * 100 : null,
        };
      })
      .filter((r) => r.margin > 0 || r.qty > 0)
      .sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));

    return NextResponse.json({ rows: ranked, pulse, cloud: true }, { headers: { 'Cache-Control': 's-maxage=30' } });
  } catch {
    return NextResponse.json({ rows: [], pulse: null, cloud: false });
  }
}
