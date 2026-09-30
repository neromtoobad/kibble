import { runEngine } from './engine';
import { metrics } from './metrics';
import { equity, TAKER_FEE, type PetState, type Personality } from './pet-math';
import type { Bar } from './bitget';
import type { Species } from './pets';

// The two numbers that turn "the risk layer works" and "the model adds something" into claims a
// judge can check. Both are pure: rows and bars in, numbers out, so they are tested on real tapes
// with no database and served by thin routes.

// ── the Guardian's ledger ───────────────────────────────────────────────
//
// Every time a risk layer overruled the pet — cut a position, or refused or shrank a buy — there is
// a trade that did not happen. Mark it to market 24 hours later, including the funding that position
// would have paid at each settlement in between: if holding would have lost money, the intervention
// saved it; if it would have made money, it cost that. Summed, that is what the risk layer was worth.

export const HORIZON_H = 24;
const RISK = new Set(['mandate', 'storm', 'weekend', 'kennel', 'kill']);

/** Funding a long of `notional` would have paid between t and t + HORIZON_H, from settled rates. */
function fundingOver(funding: Array<{ t: number; rate: number }>, t: number, notional: number): number {
  const end = t + HORIZON_H * 3600e3;
  return funding.filter((f) => f.t > t && f.t <= end).reduce((s, f) => s + notional * f.rate, 0);
}

export type Intervention = {
  ts: number; by: string; kind: string; text: string;
  /** Shares the intervention kept off (a cut) or kept out (a refused or shrunk buy). */
  qty: number; price: number;
  /** Price HORIZON_H later, or the latest bar if that has not come yet. */
  later: number; pending: boolean;
  /** What the pet would have made had it been left alone, and so what the layer saved (the negative). */
  pnlIfIgnored: number; saved: number;
  /** The part of pnlIfIgnored that is funding the ignored position would have paid (positive = paid). */
  funding: number;
};

/** Older rows predate the actor column; the mandate's own words identify them. */
function actorOf(e: { by?: string | null; text: string }): string | null {
  if (e.by) return e.by;
  if (/^(Liquidation only|Funding is \d+% a year and my limit|Leverage drifted|Risk limit overrode|Refused)/.test(e.text)) return 'mandate';
  if (/^Asked for \$[\d.]+, allowed \$[\d.]+ by the mandate/.test(e.text)) return 'mandate';
  return null;
}

function priceAt(bars: Bar[], t: number): { price: number; pending: boolean } | null {
  if (!bars.length) return null;
  const want = t + HORIZON_H * 3600e3;
  const hit = bars.find((b) => b.t >= want);
  return hit ? { price: hit.close, pending: false } : { price: bars[bars.length - 1].close, pending: true };
}

/** A diary row as the ledger needs it — read from the database, so the actor is a plain string. */
export type LedgerRow = { ts: number; kind: string; text: string; qty?: number; price?: number; by?: string | null; meta?: Record<string, unknown> };

export function guardianLedger(rows: LedgerRow[], bars: Bar[], funding: Array<{ t: number; rate: number }> = []) {
  const out: Intervention[] = [];
  for (const e of rows) {
    const by = actorOf(e);
    if (!by || !RISK.has(by)) {
      // A trade the pet made that a risk layer shrank still carries the shadow of the part it cut.
      if (!(e.kind === 'open' || e.kind === 'add') || !e.meta?.shadow) continue;
    }
    let qty = 0, side: 'kept-off' | 'kept-out';
    const shadow = e.meta?.shadow as { qty?: number; usd?: number; lever?: number; price?: number } | undefined;
    if ((e.kind === 'trim' || e.kind === 'flatten') && e.qty && e.price) { qty = e.qty; side = 'kept-off'; }
    else if (shadow?.qty && shadow.price) { qty = shadow.qty; side = 'kept-out'; }
    // A refusal or clamp from before shadows were recorded says only "asked for X, allowed Y", and
    // cannot tell a risk rule apart from the pet simply not having X. Those are left out rather than
    // scored: only the cuts, whose size is on the row, count from that period.
    else continue;
    const price = e.price ?? shadow?.price ?? bars.find((b) => b.t >= e.ts)?.close;
    const later = priceAt(bars, e.ts);
    if (!price || !later || qty <= 0) continue;
    // Had it been left alone the pet would have held these shares; round-trip fees for a buy it never made.
    const paid = fundingOver(funding, e.ts, qty * price);
    const pnl = qty * (later.price - price) - paid - (side === 'kept-out' ? 2 * qty * price * TAKER_FEE : 0);
    out.push({ ts: e.ts, by: by ?? 'mandate', kind: e.kind, text: e.text, qty, price, later: later.price, pending: later.pending, pnlIfIgnored: pnl, saved: -pnl, funding: paid });
  }
  const settled = out.filter((x) => !x.pending);
  return {
    interventions: out,
    count: out.length,
    settled: settled.length,
    saved: settled.reduce((s, x) => s + x.saved, 0),
    helped: settled.filter((x) => x.saved > 0).length,
    hurt: settled.filter((x) => x.saved < 0).length,
    byLayer: Object.fromEntries([...new Set(out.map((x) => x.by))].map((b) => [b, {
      count: out.filter((x) => x.by === b).length,
      saved: settled.filter((x) => x.by === b).reduce((s, x) => s + x.saved, 0),
    }])),
  };
}

// ── the ghost twin ──────────────────────────────────────────────────────
//
// The same pet — same stock, same personality, same starting margin, adopted at the same moment —
// run on its fixed rules alone, over the same bars and funding. The difference between the live pet
// and its twin is what the model's judgement added (or cost). The handbook asks for exactly this:
// "incremental value over fixed-rule baselines".

export function ghostTwin(opts: {
  species: Species['id']; personality: Personality; adoptedAt: number; startMargin: number;
  bars: Bar[]; funding: Array<{ t: number; rate: number }>; liveMarks: Array<[number, number]>;
}) {
  const { bars } = opts;
  const last = bars.at(-1);
  if (!last) return null;
  // A day of hourly marks is the least a comparison means anything over. A pet adopted this morning
  // has no record yet, and scoring it at "+0.00" would only dilute the average of the ones that do.
  if (opts.liveMarks.length < 24) return null;
  // The twin starts where the live record starts: the first hourly mark we have for the pet.
  const start = Math.max(opts.adoptedAt, opts.liveMarks[0]?.[0] ?? opts.adoptedAt, bars[0].t) - 1;
  const startEquity = opts.liveMarks.find(([t]) => t >= start)?.[1] ?? opts.startMargin;
  const twin: PetState = {
    species: opts.species, name: 'twin', personality: opts.personality, adoptedAt: start, lastFed: start, streak: 1, lastVisitDay: '',
    margin: startEquity, position: null, realized: 0, fundingPaid: 0, faints: 0, lastTickAt: start, marks: [], diary: [],
  };
  const r = runEngine(twin, bars, opts.funding, last.t);
  const twinEq = equity(r.pet, last.close);
  const tm = metrics(r.pet, twinEq);
  const live = opts.liveMarks.filter(([t]) => t >= start);
  const liveEq = live.at(-1)?.[1] ?? startEquity;
  const lm = metrics({ ...r.pet, marks: live, diary: [] } as PetState, liveEq);
  const pct = (a: number) => (startEquity > 0 ? ((a - startEquity) / startEquity) * 100 : 0);
  return {
    since: new Date(start + 1).toISOString(),
    startEquity,
    live: { equity: liveEq, returnPct: pct(liveEq), sharpe: lm.sharpe, maxDrawdownPct: lm.maxDrawdownPct },
    twin: { equity: twinEq, returnPct: pct(twinEq), sharpe: tm.sharpe, maxDrawdownPct: tm.maxDrawdownPct,
      trades: r.fresh.filter((e) => ['open', 'add', 'trim', 'flatten', 'liquidated'].includes(e.kind)).length },
    /** Percentage points of return the live pet has over its fixed-rule twin. */
    addedPct: pct(liveEq) - pct(twinEq),
  };
}

// ── pinky promises ──────────────────────────────────────────────────────
//
// Every model buy comes with a thesis, a target, a stop and a deadline (see Pinky in ./pet-math),
// and the engine writes each ending to the hash-chained diary as it happens. So the scorecard is a
// count of rows nobody can edit after the fact: how often the pet was right, how often wrong, how
// often the market never decided, and what reward it was promising for the risk it named.

export type PromiseOutcome = 'target' | 'stopped' | 'expired' | 'closed' | 'open';
export type PromiseLine = {
  ts: number; thesis: string; entry: number; target: number; stop: number; until: number;
  outcome: PromiseOutcome; resolvedAt: number | null; at: number | null;
};
export type PromiseCard = {
  made: number; target: number; stopped: number; expired: number; closed: number; open: number;
  /** Right ÷ (right + wrong + ran out). Closed-early promises never resolved, so they are left out. */
  hitRate: number | null;
  /** Mean of (target − entry) ÷ (entry − stop) as promised: the reward the pet named per unit of risk. */
  rewardRisk: number | null;
  recent: PromiseLine[];
};

type Vow = { ts: number; thesis: string; entry: number; target: number; stop: number; until: number };

export function promiseCard(rows: LedgerRow[], now = Date.now()): PromiseCard {
  const lines = new Map<number, PromiseLine>();
  for (const r of [...rows].filter((r) => r.kind === 'promise').sort((a, b) => a.ts - b.ts)) {
    const meta = r.meta as { outcome?: string; pinky?: Vow; at?: number } | undefined;
    const p = meta?.pinky;
    if (!p || typeof p.ts !== 'number') continue;
    if (meta?.outcome === 'made') {
      lines.set(p.ts, { ts: p.ts, thesis: p.thesis, entry: p.entry, target: p.target, stop: p.stop, until: p.until, outcome: 'open', resolvedAt: null, at: null });
      continue;
    }
    const line = lines.get(p.ts);
    // First ending wins: after a target, the stop at the entry closing the position is not a second verdict.
    if (!line || line.outcome !== 'open') continue;
    if (meta?.outcome === 'target' || meta?.outcome === 'stopped' || meta?.outcome === 'expired' || meta?.outcome === 'closed') {
      line.outcome = meta.outcome;
      line.resolvedAt = r.ts;
      line.at = typeof meta.at === 'number' ? meta.at : null;
    }
  }
  const all = [...lines.values()];
  const n = (o: PromiseOutcome) => all.filter((l) => l.outcome === o).length;
  const resolved = n('target') + n('stopped') + n('expired');
  const rr = all.filter((l) => l.entry > l.stop).map((l) => (l.target - l.entry) / (l.entry - l.stop));
  return {
    made: all.length, target: n('target'), stopped: n('stopped'), expired: n('expired'), closed: n('closed'),
    open: all.filter((l) => l.outcome === 'open' && l.until > now).length,
    hitRate: resolved ? n('target') / resolved : null,
    rewardRisk: rr.length ? rr.reduce((s, x) => s + x, 0) / rr.length : null,
    recent: all.slice(-6).reverse(),
  };
}
