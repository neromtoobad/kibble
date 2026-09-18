import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, ownerHash, pool } from '@/lib/db';
import type { Position, Proposal } from '@/lib/pet-math';

// Mirror a Stockling into Postgres. The browser posts its owner key here over same-origin HTTPS;
// only the hash is stored, and an update that doesn't match the hash is refused rather than
// silently forking a second pet.
//
// The columns are the perpetual ones — margin, position, realized, funding paid, faints and the
// hourly equity marks. That last one is what the worker needs to score Sharpe and drawdown over a
// regular series, so it is mirrored rather than recomputed.

type Body = {
  ownerKey: string;
  pet: {
    id?: string | null; species: string; ticker: string; name: string; personality: string;
    adoptedAt: number; streak: number;
    margin: number; position: Position | null; realized: number; fundingPaid: number;
    faints: number; marks: Array<[number, number]>;
    lastTickAt: number; agentId?: string | null; wallet?: string | null;
    published?: unknown; proposal?: Proposal | null; paper: boolean;
  };
  entries?: { ts: number; kind: string; text: string; qty?: number | null; price?: number | null; usd?: number | null; sig?: string | null; paper?: boolean }[];
};

export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ ok: false, reason: 'no-db' });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const { ownerKey, pet, entries = [] } = body;
  if (!ownerKey || ownerKey.length < 16 || !pet?.species) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  try {
    await ensureSchema();
    const db = pool();
    const hash = ownerHash(ownerKey);
    const iso = (ms: number) => new Date(ms).toISOString();
    const json = (v: unknown) => (v == null ? null : JSON.stringify(v));
    let id = pet.id ?? null;

    if (id) {
      const r = await db.query(
        `update pets set name=$3, personality=$4, streak=$5, margin=$6, position=$7::jsonb,
                         realized=$8, funding_paid=$9, faints=$10, marks=$11::jsonb,
                         last_tick_at=$12, agent_id=$13, wallet=$14, published=$15::jsonb,
                         paper=$16, proposal=$17::jsonb, updated_at=now()
           where id=$1 and owner_hash=$2
             and (last_tick_at is null or last_tick_at <= $12) returning id`,
        [id, hash, pet.name, pet.personality, pet.streak, pet.margin, json(pet.position),
         pet.realized, pet.fundingPaid, pet.faints, JSON.stringify(pet.marks ?? []),
         iso(pet.lastTickAt), pet.agentId ?? null, pet.wallet ?? null, json(pet.published),
         pet.paper, json(pet.proposal)],
      );
      if (!r.rowCount) {
        // Either this isn't your pet, or the hourly worker has already ticked past the state the
        // browser is holding. Losing the worker's trades to a stale push would quietly undo the
        // autonomy, so the write is dropped and the client is told to pull instead.
        const own = await db.query(`select 1 from pets where id=$1 and owner_hash=$2`, [id, hash]);
        if (!own.rowCount) return NextResponse.json({ ok: false, reason: 'not-owner' }, { status: 403 });
        return NextResponse.json({ ok: true, id, stale: true });
      }
    } else {
      const r = await db.query(
        `insert into pets (owner_hash, species, ticker, name, personality, adopted_at, streak,
                           margin, position, realized, funding_paid, faints, marks,
                           last_tick_at, agent_id, wallet, published, paper, proposal)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16,$17::jsonb,$18,$19::jsonb)
         returning id`,
        [hash, pet.species, pet.ticker, pet.name, pet.personality, iso(pet.adoptedAt), pet.streak,
         pet.margin, json(pet.position), pet.realized, pet.fundingPaid, pet.faints,
         JSON.stringify(pet.marks ?? []), iso(pet.lastTickAt), pet.agentId ?? null, pet.wallet ?? null,
         json(pet.published), pet.paper, json(pet.proposal)],
      );
      id = r.rows[0].id as string;
    }

    if (entries.length) {
      const values: unknown[] = [];
      const tuples = entries.map((e, i) => {
        const b = i * 9;
        values.push(id, new Date(e.ts).toISOString(), e.kind, e.text, e.qty ?? null, e.price ?? null, e.usd ?? null, e.sig ?? null, e.paper ?? true);
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
      });
      await db.query(
        `insert into pet_entries (pet_id, ts, kind, body, qty, price, usd, sig, paper)
         values ${tuples.join(',')} on conflict (pet_id, ts, kind) do nothing`,
        values,
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    // The cloud is a mirror; never break the app because it's unreachable.
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 200 });
  }
}
