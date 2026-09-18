import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import type { Personality, Position } from '@/lib/pet-math';

// A Stockling as a stranger sees it, for the backing page. Public by design — it is the thing you
// send to a friend — so it carries nothing private: no owner hash, no agent id, no wallet.

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!dbEnabled()) return NextResponse.json({ error: 'offline' }, { status: 503 });

  try {
    await ensureSchema();
    const { rows } = await pool().query<{
      id: string; name: string; species: string; ticker: string; personality: Personality;
      adopted_at: Date; streak: number; paper: boolean; published: { playbook: string; ts: number } | null;
      position: Position; margin: string; realized: string; funding_paid: string; faints: number;
    }>(
      `select id, name, species, ticker, personality, adopted_at, streak, paper, published,
              position, margin, realized, funding_paid, faints
         from pets where id = $1`,
      [id],
    );
    if (!rows.length) return NextResponse.json({ error: 'no such Stockling' }, { status: 404 });

    const r = rows[0];

    const recent = await pool().query<{ ts: Date; kind: string; body: string }>(
      `select ts, kind, body from pet_entries
        where pet_id = $1 and kind in ('open','add','trim','flatten','liquidated','ask','system') order by ts desc limit 5`,
      [id],
    );

    return NextResponse.json({
      id: r.id, name: r.name, species: r.species, ticker: r.ticker, personality: r.personality,
      adoptedAt: r.adopted_at.getTime(), streak: r.streak, paper: r.paper, published: r.published,
      qty: r.position?.qty ?? 0,
      entry: r.position?.entry ?? null,
      margin: Number(r.margin),
      realized: Number(r.realized),
      fundingPaid: Number(r.funding_paid),
      faints: r.faints,
      recent: recent.rows.map((e) => ({ ts: e.ts.getTime(), kind: e.kind, text: e.body })),
    }, { headers: { 'Cache-Control': 's-maxage=20' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
