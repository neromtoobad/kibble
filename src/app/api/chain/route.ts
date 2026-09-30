import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';

// The hash-chained diary, for anyone to check.
//
//   GET /api/chain          every chained row, per pet, with the fields the hash covers
//   GET /api/chain?heads=1  just each pet's current head and length — what the mirror anchors hourly
//
// scripts/verify.ts recomputes every link from this output; lib/chain.ts is the one definition of a
// row both the writer and the verifier use.

export const dynamic = 'force-dynamic';

type Row = {
  pet_id: string; name: string; ts: Date; kind: string; body: string;
  qty: string | null; price: string | null; usd: string | null;
  execution: string | null; order_id: string | null; fill_price: string | null;
  by_actor: string | null; meta: unknown; hash: string; prev_hash: string;
};

const n = (v: string | null) => (v === null ? null : Number(v));

export async function GET(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });
  const headsOnly = new URL(req.url).searchParams.get('heads') === '1';
  try {
    await ensureSchema();
    const { rows } = await pool().query<Row>(
      `select e.pet_id, p.name, e.ts, e.kind, e.body, e.qty, e.price, e.usd, e.execution, e.order_id, e.fill_price,
              e.by_actor, e.meta, e.hash, e.prev_hash
         from pet_entries e join pets p on p.id = e.pet_id
        where e.hash is not null
        order by e.pet_id, e.id`,
    );
    const pets = new Map<string, { petId: string; name: string; rows: Row[] }>();
    for (const r of rows) {
      const p = pets.get(r.pet_id) ?? { petId: r.pet_id, name: r.name, rows: [] };
      p.rows.push(r);
      pets.set(r.pet_id, p);
    }
    // Chain order, by following prev_hash from genesis — not id order.
    const ordered = [...pets.values()].map((p) => {
      const byPrev = new Map(p.rows.map((r) => [r.prev_hash, r]));
      const out: Row[] = [];
      let at = byPrev.get(`genesis:${p.petId}`);
      while (at && out.length < p.rows.length) { out.push(at); at = byPrev.get(at.hash); }
      const orphans = p.rows.length - out.length;
      return { ...p, rows: out, orphans, head: out.at(-1)?.hash ?? null };
    });

    if (headsOnly) {
      return NextResponse.json({
        at: new Date().toISOString(),
        heads: ordered.map((p) => ({ petId: p.petId, name: p.name, length: p.rows.length, head: p.head, orphans: p.orphans })),
      });
    }
    return NextResponse.json({
      note: 'Each row carries sha256(prev_hash + canonical row). Recompute with `npm run verify`, or see lib/chain.ts for the canonical form.',
      pets: ordered.map((p) => ({
        petId: p.petId, name: p.name, length: p.rows.length, head: p.head, orphans: p.orphans,
        rows: p.rows.map((r) => ({
          ts: r.ts.getTime(), kind: r.kind, body: r.body, qty: n(r.qty), price: n(r.price), usd: n(r.usd),
          execution: r.execution, orderId: r.order_id, fillPrice: n(r.fill_price), by: r.by_actor, meta: r.meta ?? null,
          hash: r.hash, prev: r.prev_hash,
        })),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
