import { runEngine } from './engine';
import { fetchBars } from './bars';
import { sense, type SensedEvent } from './feeds';
import { hasModel, judge } from './brain';
import { SPECIES, type Species } from './pets';
import type { Bar } from './bitget';
import type { Entry, PetState, Personality, Position, Proposal } from './pet-math';
import { ensureSchema, pool } from './pg';
import { settleDuels } from './duels';

// One hour of the world happening to every Stockling at once.
//
// This is the same deterministic engine the browser runs, pointed at Postgres instead of
// localStorage, so a pet behaves identically whether or not its owner has the app open. Called by
// the Railway cron service every hour, and by /api/tick on demand.

export type TickSummary = { at: number; pets: number; acted: number; waiting: number; lines: string[] };

type Row = {
  id: string; species: string; name: string; personality: Personality;
  adopted_at: Date; streak: number; margin: string; position: Position;
  realized: string; funding_paid: string; faints: number; marks: Array<[number, number]> | null;
  last_tick_at: Date | null;
  agent_id: string | null; wallet: string | null; proposal: Proposal | null;
};

export async function runTick(now = Date.now()): Promise<TickSummary> {
  await ensureSchema();
  const db = pool();
  const lines: string[] = [];

  const { rows } = await db.query<Row>(
    `select id, species, name, personality, adopted_at, streak, margin, position, realized,
            funding_paid, faints, marks, last_tick_at, agent_id, wallet, proposal
       from pets order by updated_at desc limit 500`,
  );

  // One fetch per stock, not per pet — bars, funding, and whatever happened to the company.
  const bars = new Map<string, Bar[]>();
  const funds = new Map<string, Array<{ t: number; rate: number }>>();
  const news = new Map<string, SensedEvent[]>();
  const thinking = hasModel();
  for (const id of new Set(rows.map((r) => r.species))) {
    if (!SPECIES[id as Species['id']]) continue;
    const { bars: b, funding, source } = await fetchBars(id as Species['id']);
    bars.set(id, b);
    funds.set(id, funding);
    // Sensing costs nothing and needs no key, so it runs either way; only the judging is gated.
    const evs = thinking ? await sense(id as Species['id']).catch(() => []) : [];
    news.set(id, evs);
    lines.push(`${id}: ${b.length} bars, ${funding.length} funding settlements (${source})${thinking ? `, ${evs.length} events` : ''}`);
  }
  if (!thinking) lines.push('no model key configured — pets are running on their fixed rules');

  // Each pet's most recent trade. Cooldowns and rebalance windows are measured from it, and the
  // worker otherwise hands the engine an empty diary — which is how the live owl came to add every
  // hour: with nothing to go on, its twelve-hour cooldown ran from the day the long was opened.
  const lastTrade = new Map<string, Entry>();
  const trades = await db.query<{ pet_id: string; ts: Date; kind: Entry['kind']; body: string }>(
    `select distinct on (pet_id) pet_id, ts, kind, body from pet_entries
      where kind = any($1) order by pet_id, ts desc`,
    [['open', 'add', 'trim', 'flatten', 'liquidated']],
  );
  for (const t of trades.rows) lastTrade.set(t.pet_id, { ts: t.ts.getTime(), kind: t.kind, text: t.body });

  let acted = 0, waiting = 0;
  for (const r of rows) {
    // A pet holding an open question waits for its owner. The rule that matters most is the one
    // that still applies when nobody is watching.
    if (r.proposal) { waiting++; continue; }
    const b = bars.get(r.species);
    if (!b?.length) continue;

    const adoptedAt = r.adopted_at.getTime();
    const pet: PetState = {
      species: r.species as Species['id'],
      name: r.name,
      personality: r.personality,
      adoptedAt,
      lastFed: adoptedAt,          // the worker never writes these back; the browser owns them
      streak: r.streak,
      lastVisitDay: '',
      margin: Number(r.margin),
      position: r.position ?? null,
      realized: Number(r.realized),
      fundingPaid: Number(r.funding_paid),
      faints: r.faints ?? 0,
      marks: r.marks ?? [],
      lastTickAt: r.last_tick_at ? r.last_tick_at.getTime() : adoptedAt,
      diary: lastTrade.has(r.id) ? [lastTrade.get(r.id)!] : [],
      proposal: null,
      ...(r.agent_id ? { agentId: r.agent_id } : {}),
      ...(r.wallet ? { wallet: r.wallet } : {}),
    };

    // ── sense → judge → (gate) → execute ──────────────────────────────
    // Only what broke since this pet last looked: an agent should act on news, not on the
    // fact that yesterday's news is still sitting there.
    const unseen = (news.get(r.species) ?? []).filter((e) => !e.at || new Date(e.at).getTime() > pet.lastTickAt);
    let judgement = null;
    if (thinking && unseen.length) {
      const last = b[b.length - 1];
      const rate = funds.get(r.species)?.at(-1)?.rate ?? 0;
      judgement = await judge({ pet, price: last.close, fundingRate: rate, events: unseen, now }).catch(() => null);
      if (judgement) {
        lines.push(`${r.name}: read ${unseen.length} events → ${judgement.intent.kind} (${(judgement.confidence * 100).toFixed(0)}% sure, ${judgement.model})`);
      }
    }

    const res = runEngine(pet, b, funds.get(r.species) ?? [], now, judgement);
    // The sensing itself is part of the record: what it read, whether or not it acted.
    if (judgement && unseen.length) {
      res.fresh.unshift({
        ts: judgement.ts,
        text: `Read ${unseen.length} new item${unseen.length === 1 ? '' : 's'}: ${unseen.slice(0, 3).map((e) => e.title).join(' · ')}${unseen.length > 3 ? ` (+${unseen.length - 3} more)` : ''}`,
        kind: 'sensed',
        paper: true,
      });
    }
    if (!res.fresh.length && res.pet.lastTickAt === pet.lastTickAt) continue;

    await write(r.id, res.pet, res.fresh);
    if (res.fresh.length) {
      acted++;
      for (const e of res.fresh) lines.push(`${r.name} (${r.species}): ${e.kind} — ${e.text}`);
    }
  }

  // Duels end on the hour they were due, whether or not either owner is around to watch.
  lines.push(...await settleDuels(now));

  return { at: now, pets: rows.length, acted, waiting, lines };
}

/** Only the engine-owned columns. Name, streak and feeding belong to the browser. */
async function write(id: string, pet: PetState, fresh: Entry[]) {
  const db = pool();
  await db.query(
    `update pets set margin=$2, position=$3::jsonb, realized=$4, funding_paid=$5, faints=$6,
                     marks=$7::jsonb, last_tick_at=$8, proposal=$9::jsonb, updated_at=now()
       where id=$1`,
    [id, pet.margin, pet.position ? JSON.stringify(pet.position) : null, pet.realized, pet.fundingPaid,
     pet.faints, JSON.stringify(pet.marks ?? []), new Date(pet.lastTickAt).toISOString(),
     pet.proposal ? JSON.stringify(pet.proposal) : null],
  );
  if (!fresh.length) return;

  const values: unknown[] = [];
  const tuples = fresh.map((e, i) => {
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
