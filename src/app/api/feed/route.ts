import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';

// The newest things the agents decided, promised and did, across every pet — the desk rail's ticker.
// /api/log answers the auditor with everything since the start (hundreds of kilobytes); this answers
// "what is happening right now" in a couple, and is cached for half a minute.

export const dynamic = 'force-dynamic';

const KINDS = ['decided', 'promise', 'open', 'add', 'trim', 'flatten', 'vetoed', 'liquidated'];
const TTL = 30_000;
let cache: { at: number; limit: number; body: unknown } | null = null;

type Row = { ts: Date; kind: string; body: string; by_actor: string | null; meta: Record<string, unknown> | null; name: string; species: string; ticker: string };

export async function GET(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });
  const limit = Math.min(40, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 12));
  if (cache && cache.limit === limit && Date.now() - cache.at < TTL) return NextResponse.json(cache.body);
  try {
    await ensureSchema();
    const { rows } = await pool().query<Row>(
      `select e.ts, e.kind, e.body, e.by_actor, e.meta, p.name, p.species, p.ticker
         from pet_entries e
         join pets p on p.id = e.pet_id
        where e.kind = any($1)
        order by e.ts desc
        limit $2`,
      [KINDS, limit],
    );
    const body = {
      rows: rows.map((r) => ({
        ts: r.ts.getTime(), kind: r.kind, text: r.body, by: r.by_actor, agent: r.name, species: r.species, ticker: r.ticker,
        outcome: r.kind === 'promise' ? (r.meta?.outcome as string | undefined) ?? null : null,
      })),
    };
    cache = { at: Date.now(), limit, body };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
