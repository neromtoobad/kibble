import { nyseSession } from './session';
import { MAINTENANCE, TAKER_FEE, type Personality } from './pet-math';
import type { Bar } from './bitget';

// The personality you pick at adoption IS the trading strategy AND the risk mandate.
// Each rule is a pure function of (bars, state) so the engine replays a window
// deterministically and every line of the diary can be explained. Nothing here
// touches the network.
//
// On Bitget the instrument is a perpetual, so a personality is defined by three
// numbers as much as by its rules: how much leverage it will carry, how close to
// liquidation it will sit before trimming, and what funding rate it refuses to pay.
// Those three are the risk-control layer, and they are why one pet faints and
// another doesn't.

export type Intent =
  | { kind: 'open'; usd: number; lever: number; reason: string }
  | { kind: 'add'; usd: number; reason: string }
  | { kind: 'trim'; fraction: number; reason: string }
  | { kind: 'flatten'; reason: string }
  | { kind: 'propose'; usd: number; reason: string }  // needs the owner's nod
  | { kind: 'hold'; reason: string };

export type StrategyState = {
  margin: number;        // USDT fed, sitting as collateral
  qty: number;           // contracts held
  entry: number;         // average entry
  price: number;         // current
  lever: number;         // notional / equity
  liqDistPct: number | null;
  fundingRate: number;   // per 8h, fraction; positive = the pet pays
  lastActionAt: number;
  totalFed: number;
};

export type Mandate = {
  /** Leverage this personality will carry. Always well under the exchange ceiling. */
  maxLever: number;
  /** Trim when the price sits closer than this (%) to the liquidation price. */
  minLiqDistPct: number;
  /** Refuse to hold when the annualised funding cost exceeds this (%). */
  maxFundingApr: number;
  /** Fraction of margin kept unused as a buffer. */
  reserve: number;
  blurb: string;
};

export const MANDATES: Record<Personality, Mandate> = {
  diamond: { maxLever: 2, minLiqDistPct: 25, maxFundingApr: 200, reserve: 0, blurb: 'Two times, forever. Adds on every open, never trims for price — only to stay alive.' },
  degen:   { maxLever: 8, minLiqDistPct: 12, maxFundingApr: 120, reserve: 0, blurb: 'Eight times on dips, at any hour. Cools off for six hours after each move.' },
  boomer:  { maxLever: 1.5, minLiqDistPct: 40, maxFundingApr: 25, reserve: 0.3, blurb: 'One and a half times, regular hours only, a third of the margin never deployed.' },
  quant:   { maxLever: 3, minLiqDistPct: 30, maxFundingApr: 15, reserve: 0.1, blurb: 'Three times, rebalanced weekly, and it will not pay over 15% a year to carry.' },
  owl:     { maxLever: 4, minLiqDistPct: 20, maxFundingApr: 60, reserve: 0.1, blurb: 'Only acts while the NYSE is shut — the hours the share cannot trade and the perp can.' },
};

const MIN_TICKET = 5;            // Bitget's own minimum on these contracts
const DIP = 0.02;                // 2% off the trailing high
const DEGEN_COOLDOWN = 6 * 3600e3;
const BIG_MOVE = 25;             // over $25 of new margin the pet asks first
const FUNDING_PER_YEAR = (24 / 8) * 365;

export const fundingApr = (rate: number) => rate * FUNDING_PER_YEAR * 100;

/** Highest close in the trailing `hours` before `i`. */
function recentHigh(bars: Bar[], i: number, hours = 24): number {
  let hi = 0;
  for (let j = Math.max(0, i - hours); j <= i; j++) hi = Math.max(hi, bars[j].close);
  return hi;
}

const sessionAt = (t: number) => nyseSession(new Date(t));
const isOpen = (t: number) => sessionAt(t) === 'regular';
const isShut = (t: number) => { const s = sessionAt(t); return s === 'overnight' || s === 'weekend' || s === 'holiday'; };

/** True on the first regular-session bar of a day. */
function isMarketOpenBar(bars: Bar[], i: number): boolean {
  if (!isOpen(bars[i].t)) return false;
  return i === 0 || !isOpen(bars[i - 1].t);
}

/**
 * Risk first, always. Before any personality gets a say, a position too close to
 * liquidation is trimmed and an unaffordable carry is cut. This is the layer that
 * keeps a pet alive, and it runs identically for every personality — only the
 * thresholds differ.
 */
function riskCheck(m: Mandate, s: StrategyState): Intent | null {
  if (s.qty <= 0) return null;
  if (s.liqDistPct !== null && s.liqDistPct < m.minLiqDistPct) {
    // Halve the position rather than close it: staying in the trade is the point,
    // staying alive is the constraint.
    return { kind: 'trim', fraction: 0.5, reason: `Liquidation only ${s.liqDistPct.toFixed(1)}% away. Cut the position in half to back off the edge.` };
  }
  const apr = fundingApr(s.fundingRate);
  if (apr > m.maxFundingApr) {
    return { kind: 'flatten', reason: `Funding is ${apr.toFixed(0)}% a year and my limit is ${m.maxFundingApr}%. Not paying that to hold. Closed.` };
  }
  if (s.lever > m.maxLever * 1.25) {
    return { kind: 'trim', fraction: 1 - m.maxLever / s.lever, reason: `Leverage drifted to ${s.lever.toFixed(1)}×. Trimmed back toward ${m.maxLever}×.` };
  }
  return null;
}

/**
 * The risk gate: what the mandate does to a decision the model made.
 *
 * The model is the decision-maker, but it does not get to set its own limits — otherwise the
 * limits are a suggestion. Everything it proposes comes through here first, and the outcome is
 * one of three, all of which are written to the diary:
 *
 *   vetoed  — the standing risk check fired (too near liquidation, carry too expensive,
 *             leverage drifted), and that wins outright over whatever the model wanted;
 *             or the model asked to open or add into a carry the mandate refuses to pay.
 *   clamped — the direction is allowed but the size is not, so it is cut to what the
 *             mandate and the contract's own ceiling permit.
 *   passed  — taken as proposed.
 */
export type Gated = { intent: Intent; veto: string | null; clamped: string | null };

export function gate(m: Mandate, s: StrategyState, proposed: Intent, speciesMaxLever: number): Gated {
  // Standing risk always outranks judgement.
  const risk = riskCheck(m, s);
  if (risk) {
    return { intent: risk, clamped: null, veto: `Risk limit overrode the call: ${risk.reason}` };
  }

  const apr = fundingApr(s.fundingRate);
  if ((proposed.kind === 'open' || proposed.kind === 'add') && apr > m.maxFundingApr) {
    return {
      intent: { kind: 'hold', reason: `I wanted to buy, but funding is ${apr.toFixed(0)}% a year against my ${m.maxFundingApr}% limit. Not at that price.` },
      clamped: null,
      veto: `Refused to add at ${apr.toFixed(0)}%/yr carry (limit ${m.maxFundingApr}%).`,
    };
  }

  if (proposed.kind === 'open' || proposed.kind === 'add') {
    const ceiling = Math.min(m.maxLever, speciesMaxLever);
    const deployable = Math.max(0, s.margin * (1 - m.reserve) - (s.qty * s.entry) / Math.max(ceiling, 1));
    const want = proposed.usd;
    const usd = Math.min(want, deployable);
    if (usd < MIN_TICKET) {
      return {
        intent: { kind: 'hold', reason: `Nothing left to work with — my reserve stays untouched.` },
        clamped: null,
        veto: `Refused: only $${deployable.toFixed(2)} deployable, under the $${MIN_TICKET} minimum.`,
      };
    }
    const clamped = usd < want - 0.01 ? `Asked for $${want.toFixed(2)}, allowed $${usd.toFixed(2)} by the mandate.` : null;
    const intent: Intent = proposed.kind === 'open'
      ? { kind: 'open', usd, lever: Math.min(proposed.lever, ceiling), reason: proposed.reason }
      : { kind: 'add', usd, reason: proposed.reason };
    return { intent, clamped, veto: null };
  }

  return { intent: proposed, clamped: null, veto: null };
}

/** What would this personality do at bar `i`? One intent per bar, or null for nothing. */
export function decide(p: Personality, bars: Bar[], i: number, s: StrategyState): Intent | null {
  const m = MANDATES[p];
  const bar = bars[i];

  const risk = riskCheck(m, s);
  if (risk) return risk;

  const deployable = Math.max(0, s.margin * (1 - m.reserve) - (s.qty * s.entry) / Math.max(m.maxLever, 1));
  const canSpend = s.margin >= MIN_TICKET && s.lever < m.maxLever * 0.95;
  const apr = fundingApr(s.fundingRate);

  switch (p) {
    case 'diamond': {
      // Opens at the first chance and adds at every open. Never trims for price.
      if (!canSpend) return null;
      if (s.qty === 0) return { kind: 'open', usd: s.margin, lever: m.maxLever, reason: `Opened at ${m.maxLever}× and I intend to keep it. Funding is ${apr.toFixed(0)}% a year — survivable.` };
      if (isMarketOpenBar(bars, i) && deployable >= MIN_TICKET) return { kind: 'add', usd: deployable, reason: 'Opening bell. Added everything spare.' };
      return null;
    }
    case 'degen': {
      // Dips, any hour, 40% clips, cooldown. Asks first above $25.
      if (!canSpend) return null;
      if (bar.t - s.lastActionAt < DEGEN_COOLDOWN) return null;
      const hi = recentHigh(bars, i);
      const off = (hi - bar.close) / hi;
      if (off < DIP) return null;
      const usd = Math.max(MIN_TICKET, s.margin * 0.4);
      const why = `down ${(off * 100).toFixed(1)}% from the 24h high`;
      if (usd > BIG_MOVE) return { kind: 'propose', usd, reason: why };
      return s.qty === 0
        ? { kind: 'open', usd, lever: m.maxLever, reason: `${why[0].toUpperCase()}${why.slice(1)}. Opened at ${m.maxLever}×.` }
        : { kind: 'add', usd, reason: `${why[0].toUpperCase()}${why.slice(1)}. Added to it.` };
    }
    case 'boomer': {
      // Regular hours only, a third of the margin never deployed, one move a day.
      if (!isMarketOpenBar(bars, i)) return null;
      if (deployable < MIN_TICKET) return { kind: 'hold', reason: 'Reserve stays where it is. One does not deploy everything.' };
      if (apr > m.maxFundingApr) return { kind: 'hold', reason: `Funding is ${apr.toFixed(0)}% a year. I'll wait for a cheaper day.` };
      return s.qty === 0
        ? { kind: 'open', usd: deployable, lever: m.maxLever, reason: `Opened during regular hours at ${m.maxLever}×, as is proper.` }
        : { kind: 'add', usd: deployable, reason: 'Added during regular hours, as is proper.' };
    }
    case 'quant': {
      // Weekly rebalance, and it genuinely watches the carry.
      if (apr > m.maxFundingApr) return { kind: 'hold', reason: `Carry is ${apr.toFixed(0)}% a year against a ${m.maxFundingApr}% limit. Sitting out.` };
      const weekly = bar.t - s.lastActionAt >= 7 * 86400e3;
      if (!canSpend || !weekly || !isOpen(bar.t)) return null;
      return s.qty === 0
        ? { kind: 'open', usd: s.margin * (1 - m.reserve), lever: m.maxLever, reason: `Weekly rebalance. Opened at ${m.maxLever}× with carry at ${apr.toFixed(0)}%.` }
        : { kind: 'add', usd: deployable, reason: `Weekly rebalance executed. Carry ${apr.toFixed(0)}% a year.` };
    }
    case 'owl': {
      // The whole thesis as a personality: it only acts in the hours the share
      // cannot trade and the perpetual can.
      if (!isShut(bar.t)) return null;
      if (!canSpend) return null;
      if (bar.t - s.lastActionAt < 12 * 3600e3) return null;
      const label = sessionAt(bar.t) === 'weekend' ? 'The weekend' : 'The night shift';
      return s.qty === 0
        ? { kind: 'open', usd: s.margin * (1 - m.reserve), lever: m.maxLever, reason: `${label}. The share is shut and this is the only price. Opened at ${m.maxLever}×.` }
        : { kind: 'add', usd: Math.max(MIN_TICKET, deployable), reason: `${label} again. Added while nobody else could.` };
    }
  }
}

export { MIN_TICKET, TAKER_FEE, MAINTENANCE };
