import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, ownerHash, pool } from '@/lib/db';
import { KENNEL } from '@/lib/risk';

// The kennel breaker and the kill switch.
//
//   GET  /api/kennel   every kennel's latest verdict, as the worker last computed it — public, and
//                      carrying pet names rather than owner hashes
//   POST /api/kennel   { ownerKey, halt: true|false, reason? } — the owner pulls or resets their
//                      own kill switch. The worker flattens every pet in that kennel on its next
//                      tick and takes no new risk until it is reset.
//
// An operator can halt every kennel at once with the tick secret: header x-tick-secret, body
// { all: true, halt: true }. That is the "stop everything" a production agent should have.

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });
  try {
    await ensureSchema();
    const { rows } = await pool().query<{ halted: boolean; reason: string | null; status: Record<string, unknown> | null; updated_at: Date; names: string[] | null }>(
      `select k.halted, k.reason, k.status, k.updated_at,
              (select array_agg(p.name order by p.adopted_at) from pets p where p.owner_hash = k.owner_hash) as names
         from kennel_controls k order by k.updated_at desc limit 100`,
    );
    return NextResponse.json({
      limits: KENNEL,
      note: 'One kennel per owner. The breaker is computed every tick from the combined hourly equity of all of the owner\'s pets.',
      kennels: rows.map((r) => ({ pets: r.names ?? [], halted: r.halted, haltReason: r.reason, status: r.status, updatedAt: r.updated_at.toISOString() })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });
  let body: { ownerKey?: string; halt?: boolean; reason?: string; all?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }
  const halt = body.halt === true;
  const reason = halt ? (body.reason?.slice(0, 200) || 'pulled by the owner.') : null;

  try {
    await ensureSchema();
    const db = pool();

    if (body.all) {
      const secret = process.env.TICK_SECRET;
      if (!secret || req.headers.get('x-tick-secret') !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      const owners = await db.query<{ owner_hash: string }>(`select owner_hash from pets group by owner_hash`);
      for (const o of owners.rows) {
        await db.query(
          `insert into kennel_controls (owner_hash, halted, reason, updated_at) values ($1, $2, $3, now())
           on conflict (owner_hash) do update set halted = excluded.halted, reason = excluded.reason, updated_at = now()`,
          [o.owner_hash, halt, halt ? (body.reason?.slice(0, 200) || 'halted by the operator.') : null],
        );
      }
      return NextResponse.json({ ok: true, kennels: owners.rows.length, halted: halt });
    }

    if (!body.ownerKey || body.ownerKey.length < 16) return NextResponse.json({ error: 'bad request' }, { status: 400 });
    const hash = ownerHash(body.ownerKey);
    const own = await db.query(`select 1 from pets where owner_hash=$1 limit 1`, [hash]);
    if (!own.rowCount) return NextResponse.json({ error: 'no pets for this device' }, { status: 404 });
    await db.query(
      `insert into kennel_controls (owner_hash, halted, reason, updated_at) values ($1, $2, $3, now())
       on conflict (owner_hash) do update set halted = excluded.halted, reason = excluded.reason, updated_at = now()`,
      [hash, halt, reason],
    );
    return NextResponse.json({
      ok: true,
      halted: halt,
      note: halt
        ? 'Every pet in this kennel is flattened on the next tick, within 15 minutes, and takes no new risk until you reset it.'
        : 'Reset. The pets go back to their own mandates on the next tick.',
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
