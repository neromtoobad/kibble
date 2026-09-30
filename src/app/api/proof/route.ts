import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import { fetchBars } from '@/lib/bars';
import { guardianLedger, ghostTwin, promiseCard, HORIZON_H } from '@/lib/proof';
import { SPECIES, type Species } from '@/lib/pets';
import type { EntryKind, Personality } from '@/lib/pet-math';

// The proof behind the two claims this agent makes, computed live from its own diary and the real
// tape. Public and read-only, like /api/log.
//
//   guardian  every time a risk layer overruled a pet, what the ignored trade would have made or lost
//             over the next 24 hours, funding included — what the risk layer was worth, in dollars
//   twin      each pet against a fixed-rule copy of itself on the same bars — what the model added
//   promises  every thesis the model bought on, graded by how it ended — was the model right
//
// Cached for five minutes: it replays every pet and fetches every tape.

export const dynamic = 'force-dynamic';

type PetRow = { id: string; name: string; species: string; personality: Personality; adopted_at: Date; marks: Array<[number, number]> | null };
type EntryRow = { pet_id: string; ts: Date; kind: EntryKind; body: string; qty: string | null; price: string | null; by_actor: string | null; meta: Record<string, unknown> | null };

let cache: { at: number; body: unknown } | null = null;
const TTL = 5 * 60e3;
const n = (v: string | null) => (v === null ? undefined : Number(v));

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.body);
  try {
    await ensureSchema();
    const pets = await pool().query<PetRow>(`select id, name, species, personality, adopted_at, marks from pets order by adopted_at asc limit 50`);
    const entries = await pool().query<EntryRow>(
      `select pet_id, ts, kind, body, qty, price, by_actor, meta
         from pet_entries where kind = any($1) order by ts asc`,
      [['trim', 'flatten', 'vetoed', 'open', 'add', 'promise']],
    );
    const tapes = new Map<string, Awaited<ReturnType<typeof fetchBars>>>();
    for (const sp of new Set(pets.rows.map((p) => p.species))) {
      if (SPECIES[sp as Species['id']]) tapes.set(sp, await fetchBars(sp as Species['id'], 14));
    }

    const agents = pets.rows.map((p) => {
      const tape = tapes.get(p.species);
      const rows = entries.rows.filter((e) => e.pet_id === p.id)
        .map((e) => ({ ts: e.ts.getTime(), kind: e.kind, text: e.body, qty: n(e.qty), price: n(e.price), by: e.by_actor, meta: e.meta ?? undefined }));
      const g = tape ? guardianLedger(rows, tape.bars, tape.funding) : null;
      const t = tape ? ghostTwin({
        species: p.species as Species['id'], personality: p.personality, adoptedAt: p.adopted_at.getTime(), startMargin: 50,
        bars: tape.bars, funding: tape.funding, liveMarks: p.marks ?? [],
      }) : null;
      return {
        agent: p.name, instrument: SPECIES[p.species as Species['id']]?.symbol ?? p.species, personality: p.personality,
        guardian: g && {
          interventions: g.count, settled: g.settled, saved: g.saved, helped: g.helped, hurt: g.hurt, byLayer: g.byLayer,
          recent: g.interventions.slice(-8).reverse(),
        },
        twin: t,
        promises: promiseCard(rows),
      };
    });

    const settled = agents.flatMap((a) => (a.guardian ? [a.guardian] : []));
    const twins = agents.flatMap((a) => (a.twin ? [a.twin] : []));
    const body = {
      note: `Guardian: each risk-layer intervention marked to market ${HORIZON_H}h later, funding included; saved = what ignoring it would have lost. Refusals from before shadow trades were recorded (30 Sep) are not scored, only cuts. Twin: the same pet on its fixed rules alone, replayed on the same bars from its first hourly mark; the live pet ran older code early on, so "added" is the model plus those changes, against today's rules. Promises: every model buy states a thesis, a target, a stop and a deadline, and is graded by whichever comes first; closed-early promises are counted but not scored.`,
      as_of: new Date().toISOString(),
      totals: {
        interventions: settled.reduce((s, g) => s + g.interventions, 0),
        settled: settled.reduce((s, g) => s + g.settled, 0),
        saved: settled.reduce((s, g) => s + g.saved, 0),
        helped: settled.reduce((s, g) => s + g.helped, 0),
        hurt: settled.reduce((s, g) => s + g.hurt, 0),
        twinAddedPctAvg: twins.length ? twins.reduce((s, t) => s + t.addedPct, 0) / twins.length : null,
        promises: (() => {
          const c = agents.map((a) => a.promises);
          const sum = (k: 'made' | 'target' | 'stopped' | 'expired' | 'closed' | 'open') => c.reduce((s, x) => s + x[k], 0);
          const resolved = sum('target') + sum('stopped') + sum('expired');
          return { made: sum('made'), target: sum('target'), stopped: sum('stopped'), expired: sum('expired'), closed: sum('closed'), open: sum('open'), hitRate: resolved ? sum('target') / resolved : null };
        })(),
      },
      agents,
    };
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
