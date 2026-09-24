import { decide, gate, MANDATES, MIN_TICKET, TAKER_FEE, fundingApr, type Intent, type StrategyState } from './strategy';
import type { Judgement } from './brain';
import { MAINTENANCE, isPaper, liquidationPrice, liquidationDistance, leverage, type Entry, type PetState } from './pet-math';
import { SPECIES } from './pets';
import type { Bar } from './bitget';

// Replays the hours since the pet last ticked and applies whatever its strategy decided.
// Deterministic: the same bars, funding and state always produce the same actions, so the
// diary is reproducible and every line can be explained. Pure — it returns the next pet
// rather than storing it. The browser writes the result to localStorage, the hourly worker
// writes it to Postgres, and both get identical actions from identical inputs.
//
// Three things happen per bar, in this order, because that is the order the exchange does them:
//   1. FUNDING settles on the 8-hour boundary and is taken out of margin. Positive rate =
//      the pet pays. This is the cost of being alive and it is what makes it hungry.
//   2. LIQUIDATION is checked against the bar's LOW, not its close — a wick that touches the
//      liquidation price liquidates you, and pretending otherwise would flatter every pet.
//   3. The personality gets to act.

export type TickResult = { pet: PetState; fresh: Entry[]; from: number; to: number };

/** Funding settlements land at 00:00, 08:00 and 16:00 UTC. */
const isFundingBar = (t: number) => new Date(t).getUTCHours() % 8 === 0;

export function runEngine(
  pet: PetState,
  bars: Bar[],
  fundingRates: Array<{ t: number; rate: number }>,
  now = Date.now(),
  // What the model decided, if it was asked. Passed IN rather than fetched here, so this
  // function stays pure and a replay of the same inputs always produces the same diary. It
  // applies to the last bar of the window — the one the model actually looked at.
  judgement?: Judgement | null,
): TickResult {
  const from = pet.lastTickAt || pet.adoptedAt;
  const window = bars.filter((b) => b.t > from && b.t <= now).sort((a, b) => a.t - b.t);
  if (!window.length) return { pet, fresh: [], from, to: now };

  const sp = SPECIES[pet.species];
  const mandate = MANDATES[pet.personality];
  const paper = isPaper(pet);
  const fresh: Entry[] = [];

  // Working copy of everything the engine mutates.
  let margin = pet.margin;
  let qty = pet.position?.qty ?? 0;
  let entry = pet.position?.entry ?? 0;
  let openedAt = pet.position?.openedAt ?? 0;
  let realized = pet.realized;
  let fundingPaid = pet.fundingPaid;
  let faints = pet.faints;
  let proposal = pet.proposal ?? null;
  // When the pet last ACTED — not when it was adopted. Cooldowns and rebalance windows are
  // measured from this, so seeding it with `adoptedAt` would put it in the future of every
  // historical bar being replayed and silence the pet forever. A pet that has never acted
  // has no cooldown to serve.
  //
  // And it is the LATEST action, not the position's first one. `openedAt` is when the long was
  // opened; measured from that, every add or trim after the first looked like it had long since
  // served its cooldown. Live, the owl re-added every hour the NYSE was shut, and the worker's
  // Quant forgot its weekly window the moment it flattened.
  const ACTIONS = new Set<Entry['kind']>(['open', 'add', 'trim', 'flatten', 'liquidated']);
  let lastActionAt = Math.max(
    pet.position?.openedAt ?? 0,
    [...pet.diary].reverse().find((e) => ACTIONS.has(e.kind))?.ts ?? 0,
  );
  const marks: Array<[number, number]> = [...(pet.marks ?? [])];

  /** The settled rate at or before `t`, else the most recent one we have. */
  const rateAt = (t: number): number => {
    let r = 0;
    for (const f of fundingRates) {
      if (f.t <= t) r = f.rate;
      else break;
    }
    return r;
  };

  const snapshot = (price: number, t: number): StrategyState => {
    const pseudo = { ...pet, margin, position: qty > 0 ? { qty, entry, openedAt } : null } as PetState;
    return {
      margin,
      qty,
      entry,
      price,
      lever: leverage(pseudo, price),
      liqDistPct: liquidationDistance(pseudo, price),
      fundingRate: rateAt(t),
      lastActionAt,
      totalFed: margin + qty * entry,
    };
  };

  const closeAll = (price: number, t: number, kind: Entry['kind'], text: string) => {
    if (qty <= 0) return;
    const gross = qty * (price - entry);
    const fee = qty * price * TAKER_FEE;
    realized += gross - fee;
    margin += gross - fee;
    fresh.push({ ts: t, text, kind, qty, price, usd: gross - fee, paper });
    qty = 0;
    entry = 0;
    openedAt = 0;
    lastActionAt = t;
  };

  for (const bar of window) {
    const i = bars.findIndex((b) => b.t === bar.t);

    // ── 1. funding settles ────────────────────────────────────────────
    if (qty > 0 && isFundingBar(bar.t)) {
      const rate = rateAt(bar.t);
      const payment = qty * bar.close * rate; // positive = the long pays
      if (Math.abs(payment) > 1e-9) {
        margin -= payment;
        fundingPaid += payment;
        const apr = fundingApr(rate);
        fresh.push({
          ts: bar.t,
          text: payment > 0
            ? `Paid $${payment.toFixed(4)} in funding — ${apr.toFixed(0)}% a year to hold this. That comes out of my bowl.`
            : `Collected $${Math.abs(payment).toFixed(4)} in funding — the shorts are paying me ${Math.abs(apr).toFixed(0)}% a year to sit here.`,
          kind: 'funding',
          usd: payment,
          paper,
        });
      }
    }

    // ── 2. liquidation, checked against the wick ──────────────────────
    if (qty > 0) {
      const pseudo = { ...pet, margin, position: { qty, entry, openedAt } } as PetState;
      const liq = liquidationPrice(pseudo);
      if (liq !== null && liq > 0 && bar.low <= liq) {
        const lost = margin + qty * (liq - entry);
        realized += lost - margin;
        fresh.push({
          ts: bar.t,
          text: `Liquidated at $${liq.toFixed(2)}. ${sp.ticker} wicked to $${bar.low.toFixed(2)} and my margin was gone. I fainted.`,
          kind: 'liquidated',
          qty,
          price: liq,
          usd: -margin,
          paper,
        });
        qty = 0; entry = 0; openedAt = 0; margin = Math.max(0, lost);
        faints += 1;
        lastActionAt = bar.t;
        proposal = null;
        continue; // nothing else happens on the bar you faint
      }
    }

    // Mark to market on every bar, before the personality acts — a regular hourly
    // series is what Sharpe and drawdown are defined over.
    marks.push([bar.t, margin + qty * (bar.close - entry)]);

    // ── 3. the agent acts ─────────────────────────────────────────────
    if (proposal) continue; // one open question at a time; the pet waits for an answer

    const state = snapshot(bar.close, bar.t);
    let intent: Intent | null;

    // The model's call applies to the bar it was shown — the last one in the window. Every
    // earlier bar replays on the fixed rules, which is what makes the personality a baseline
    // rather than a decoration.
    const judged = judgement && bar.t === window[window.length - 1].t;
    if (judged) {
      const g = gate(mandate, state, judgement.intent, sp.maxLever);
      fresh.push({
        ts: bar.t,
        text: `Read ${judgement.cited.length || 'no'} item${judgement.cited.length === 1 ? '' : 's'} and decided: ${judgement.intent.kind}. ${judgement.rationale}`,
        kind: 'decided',
        paper,
      });
      if (g.veto) fresh.push({ ts: bar.t, text: g.veto, kind: 'vetoed', paper });
      else if (g.clamped) fresh.push({ ts: bar.t, text: g.clamped, kind: 'vetoed', paper });
      intent = g.intent;
    } else {
      intent = decide(pet.personality, bars, i < 0 ? 0 : i, state);
    }
    if (!intent) continue;

    if (intent.kind === 'open' || intent.kind === 'add') {
      // The reserve and the leverage ceiling bind the fixed rules exactly as gate() binds the
      // model. Without this a rule could push past them, and the next model call would read the
      // breach and trim it back — a buy and a sell, two fees, and nothing decided.
      const ceiling = Math.min(mandate.maxLever, sp.maxLever);
      const deployable = margin * (1 - mandate.reserve) - (qty * entry) / Math.max(ceiling, 1);
      const usd = Math.min(intent.usd, margin, deployable);
      if (usd < MIN_TICKET) continue;
      const lever = intent.kind === 'open' ? Math.min(intent.lever, sp.maxLever, mandate.maxLever) : mandate.maxLever;
      const addQty = (usd * lever) / bar.close;
      const fee = addQty * bar.close * TAKER_FEE;
      if (fee >= margin) continue;
      margin -= fee;
      entry = qty + addQty > 0 ? (qty * entry + addQty * bar.close) / (qty + addQty) : bar.close;
      qty += addQty;
      if (!openedAt) openedAt = bar.t;
      lastActionAt = bar.t;
      fresh.push({ ts: bar.t, text: intent.reason, kind: intent.kind, qty: addQty, price: bar.close, usd, paper });
    } else if (intent.kind === 'trim') {
      const cut = Math.max(0, Math.min(0.95, intent.fraction)) * qty;
      if (cut <= 0) continue;
      const gross = cut * (bar.close - entry);
      const fee = cut * bar.close * TAKER_FEE;
      realized += gross - fee;
      margin += gross - fee;
      qty -= cut;
      if (qty < 1e-9) { qty = 0; entry = 0; openedAt = 0; }
      lastActionAt = bar.t;
      fresh.push({ ts: bar.t, text: intent.reason, kind: 'trim', qty: cut, price: bar.close, usd: gross - fee, paper });
    } else if (intent.kind === 'flatten') {
      closeAll(bar.close, bar.t, 'flatten', intent.reason);
    } else if (intent.kind === 'propose') {
      proposal = { ts: bar.t, usd: Math.min(intent.usd, margin), reason: intent.reason };
      fresh.push({ ts: bar.t, text: `Wants to put $${proposal.usd.toFixed(0)} more at risk — ${intent.reason}.`, kind: 'ask', usd: proposal.usd });
    } else if (intent.kind === 'hold' && !fresh.some((f) => f.kind === 'hold')) {
      fresh.push({ ts: bar.t, text: intent.reason, kind: 'hold' });
    }
  }

  const next: PetState = {
    ...pet,
    margin,
    position: qty > 0 ? { qty, entry, openedAt } : null,
    realized,
    fundingPaid,
    faints,
    proposal,
    lastTickAt: now,
    marks: marks.slice(-720), // 30 days of hourly marks
    diary: [...pet.diary, ...fresh].slice(-400),
  };
  return { pet: next, fresh, from, to: now };
}

export { MAINTENANCE };
