import type { Species } from './pets';

// The shape of a Stockling and the arithmetic over it. Free of React and of storage:
// the browser, the API routes and the hourly worker all reason about the same pet, so
// the numbers on the board are the numbers the engine acted on.
//
// A Stockling on Bitget holds an ISOLATED LONG in its home stock's perpetual. That
// changes three things versus holding a share:
//   • Funding settles every 8 hours. A positive rate means the pet PAYS to hold —
//     it is literally the cost of being alive, and it is what makes the pet hungry.
//   • Leverage. The pet can hold more than you fed it, and each species has its own
//     ceiling (Bitget's maxLever), so some creatures are built for more risk.
//   • It can be liquidated. A pet that runs out of margin faints, loses the position,
//     and has to be fed back to life. That is the point: the risk is real.

export type Personality = 'diamond' | 'degen' | 'boomer' | 'quant' | 'owl';

// 'sensed', 'decided' and 'vetoed' are the audit trail of one agent turn: what it read, what
// the model chose, and what the mandate did about it. Together with the execution kinds below
// they are the event → decision → execution flow, in order, in one place.
export type EntryKind =
  | 'feed' | 'open' | 'add' | 'trim' | 'flatten' | 'funding' | 'hold' | 'ask' | 'liquidated' | 'system'
  | 'sensed' | 'decided' | 'vetoed';
export type Entry = {
  ts: number;
  text: string;
  kind: EntryKind;
  qty?: number;
  price?: number;
  usd?: number;
  sig?: string;
  paper?: boolean;
  /** Set when Bitget's demo exchange executed this row: its order id and the price it filled at. */
  order?: string;
  fill?: number;
  exec?: 'demo';
};

export type Position = {
  qty: number;      // contracts held (1 contract = 1 share of the underlying)
  entry: number;    // volume-weighted average entry price
  openedAt: number;
} | null;

export type Proposal = { ts: number; usd: number; reason: string };

export type PetState = {
  species: Species['id'];
  name: string;
  personality: Personality;
  adoptedAt: number;
  lastFed: number;
  streak: number;
  lastVisitDay: string;
  /** USDT fed in and sitting as isolated margin. */
  margin: number;
  position: Position;
  /** Closed PnL, lifetime. */
  realized: number;
  /** Funding paid out (positive) or received (negative), lifetime. */
  fundingPaid: number;
  /** How many times it has fainted. */
  faints: number;
  lastTickAt: number;
  /**
   * Hourly mark-to-market, [timestamp, equity], oldest first, capped at 30 days.
   * Sharpe and drawdown need a REGULAR series — scoring sparse event timestamps as if
   * they were hourly returns produces nonsense — so the engine marks every bar it walks.
   */
  marks: Array<[number, number]>;
  diary: Entry[];
  proposal?: Proposal | null;
  agentId?: string;   // a live agent behind it means execution is real, not paper
  wallet?: string;
  published?: { playbook: string; ts: number };
};

/** No agent behind it means the trades are simulated, and every surface says so. */
export const isPaper = (p: PetState) => !p.agentId;

// ── position math ─────────────────────────────────────────────────────
// Isolated margin. Bitget's maintenance rate is tiered by notional; at the sizes a
// pet trades the first tier applies, so a flat 0.5% is used and stated everywhere.
export const MAINTENANCE = 0.005;
export const TAKER_FEE = 0.0006;

export const notional = (p: PetState, price: number) => (p.position ? p.position.qty * price : 0);
export const unrealized = (p: PetState, price: number) => (p.position ? p.position.qty * (price - p.position.entry) : 0);
export const equity = (p: PetState, price: number) => p.margin + unrealized(p, price);
export const leverage = (p: PetState, price: number) => {
  const eq = equity(p, price);
  return eq > 0 ? notional(p, price) / eq : 0;
};

/**
 * The price at which an isolated long runs out of margin.
 *   equity = margin + qty(P − entry),  maintenance = qty·P·MAINTENANCE
 *   liquidate when equity ≤ maintenance
 */
export function liquidationPrice(p: PetState): number | null {
  if (!p.position || p.position.qty <= 0) return null;
  const { qty, entry } = p.position;
  return (qty * entry - p.margin) / (qty * (1 - MAINTENANCE));
}

/** How far the current price is above the liquidation price, as a percentage. */
export function liquidationDistance(p: PetState, price: number): number | null {
  const liq = liquidationPrice(p);
  return liq === null || liq <= 0 || price <= 0 ? null : ((price - liq) / price) * 100;
}

/** Everything the pet is worth right now, if it closed at `price`. */
export function pnl(p: PetState, price: number) {
  const un = unrealized(p, price);
  const eq = equity(p, price);
  const basis = p.position ? p.position.qty * p.position.entry : 0;
  return {
    unrealized: un,
    realized: p.realized,
    equity: eq,
    basis,
    pct: basis > 0 ? (un / basis) * 100 : 0,
    fundingPaid: p.fundingPaid,
  };
}

/** Lifetime deposits — what the owner has actually put in. */
export const totalFed = (p: PetState) =>
  p.diary.filter((e) => e.kind === 'feed').reduce((s, e) => s + (e.usd ?? 0), 0);

/**
 * Hunger, 0..1 (1 = just fed). Two drains, both honest to the instrument:
 * time since the last feed, and the funding this position has paid since then.
 * A pet holding an expensive carry gets hungry faster than one that isn't — the
 * care loop IS the cost of the position.
 */
export const FEED_WINDOW_MS = 20 * 3600e3;
export function hunger(p: PetState, now = Date.now()): number {
  const byTime = (now - p.lastFed) / FEED_WINDOW_MS;
  const fedSince = p.diary
    .filter((e) => e.kind === 'funding' && e.ts > p.lastFed)
    .reduce((s, e) => s + (e.usd ?? 0), 0);
  const byFunding = p.margin > 0 ? Math.max(0, fedSince) / p.margin : 0;
  return Math.max(0, Math.min(1, 1 - byTime - byFunding));
}
