import { dbEnabled, ensureSchema, pool } from './db';
import { metrics } from './metrics';
import { FAMILIES, SPECIES, type Family, type Mood } from './pets';
import type { Personality, Pinky, PetState, Position } from './pet-math';

// One Stockling as a stranger sees it: the public page at /p/<id> and the share card behind it
// read the same record, computed the way /api/metrics computes it, so a card can never claim a
// number the Proof page does not. Nothing private: no owner hash, no agent id, no wallet.

export type Card = {
  id: string; name: string; family: Family; species: string; ticker: string; company: string; symbol: string;
  personality: Personality; execution: 'demo' | 'sim';
  since: number | null; equity: number; returnPct: number | null;
  sharpe: number | null; maxDrawdownPct: number | null; closes: number; faints: number;
  holding: boolean; pinky: Pinky | null; mood: Mood;
  recent: Array<{ ts: number; kind: string; text: string }>;
};

type Row = {
  id: string; name: string; species: string; ticker: string; personality: Personality; execution: string | null;
  position: Position; margin: string; realized: string; funding_paid: string; faints: number | null; marks: Array<[number, number]> | null;
};

export async function loadCard(id: string): Promise<Card | null> {
  if (!dbEnabled() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureSchema();
  const { rows } = await pool().query<Row>(
    `select id, name, species, ticker, personality, execution, position, margin, realized, funding_paid, faints, marks
       from pets where id = $1`,
    [id],
  );
  const r = rows[0];
  const sp = r && SPECIES[r.species];
  if (!r || !sp) return null;

  const entries = await pool().query<{ ts: Date; kind: string; body: string; qty: string | null; price: string | null; usd: string | null }>(
    `select ts, kind, body, qty, price, usd from pet_entries where pet_id = $1 order by ts asc`,
    [id],
  );
  const num = (v: string | null) => (v === null ? undefined : Number(v));
  const diary = entries.rows.map((e) => ({ ts: e.ts.getTime(), kind: e.kind, text: e.body, qty: num(e.qty), price: num(e.price), usd: num(e.usd) }));

  const marks = r.marks ?? [];
  const equity = marks.at(-1)?.[1] ?? Number(r.margin);
  const start = marks[0]?.[1] ?? null;
  const m = metrics({ ...({} as PetState), marks, diary, realized: Number(r.realized), fundingPaid: Number(r.funding_paid), faints: r.faints ?? 0 } as PetState, equity);
  const returnPct = start ? ((equity - start) / start) * 100 : null;
  const faints = r.faints ?? 0;
  const fainted = faints > 0 && !r.position && Number(r.margin) < 1;
  const mood: Mood = fainted ? 'fainted' : returnPct === null ? 'happy' : returnPct > 3 ? 'ecstatic' : returnPct >= 0 ? 'happy' : returnPct > -5 ? 'nervous' : 'sulking';

  const WORDS = new Set(['open', 'add', 'trim', 'flatten', 'liquidated', 'decided', 'promise', 'vetoed']);
  return {
    id: r.id, name: r.name, family: sp.family, species: FAMILIES[sp.family].species, ticker: sp.ticker, company: sp.company, symbol: sp.symbol,
    personality: r.personality, execution: r.execution === 'demo' ? 'demo' : 'sim',
    since: marks[0]?.[0] ?? null, equity, returnPct,
    sharpe: m.sharpe, maxDrawdownPct: m.maxDrawdownPct, closes: m.trades, faints,
    holding: Boolean(r.position?.qty), pinky: r.position?.pinky ?? null, mood,
    recent: diary.filter((e) => WORDS.has(e.kind)).slice(-6).reverse().map((e) => ({ ts: e.ts, kind: e.kind, text: e.text })),
  };
}
