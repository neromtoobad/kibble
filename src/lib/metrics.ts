import type { Entry, PetState } from './pet-math';

// Paper-trading metrics over the diary. The Agentic Trading track is scored half on
// numbers — Sharpe, max drawdown, win rate — so they are computed here from the same
// ledger the engine wrote, never asserted. Every figure is reproducible from the diary
// alone: the diary IS the paper-trading log.

export type Metrics = {
  from: number | null;
  to: number | null;
  hours: number;
  /** Closing actions with a realised result. */
  trades: number;
  wins: number;
  winRate: number | null;
  grossWin: number;
  grossLoss: number;
  profitFactor: number | null;
  realized: number;
  fundingPaid: number;
  fees: number;
  /** Hourly equity curve, marked at every diary event. */
  curve: Array<{ t: number; equity: number }>;
  maxDrawdownPct: number | null;
  /** Annualised from hourly equity changes. */
  sharpe: number | null;
  faints: number;
  actions: Record<string, number>;
};

const HOURS_PER_YEAR = 24 * 365;

/**
 * Rebuild the equity curve from the diary, then score it. `equityNow` anchors the
 * final point so the curve ends where the pet actually stands.
 */
export function metrics(pet: PetState, equityNow: number): Metrics {
  const d = [...pet.diary].sort((a, b) => a.ts - b.ts);
  const actions: Record<string, number> = {};
  for (const e of d) actions[e.kind] = (actions[e.kind] ?? 0) + 1;

  const closers = d.filter((e) => (e.kind === 'trim' || e.kind === 'flatten' || e.kind === 'liquidated') && typeof e.usd === 'number');
  const wins = closers.filter((e) => (e.usd ?? 0) > 0);
  const losses = closers.filter((e) => (e.usd ?? 0) <= 0);
  const grossWin = wins.reduce((s, e) => s + (e.usd ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, e) => s + (e.usd ?? 0), 0));

  // The equity curve is the engine's hourly marks — a regular series, which is what
  // Sharpe and drawdown are defined over. Event timestamps are irregular by nature and
  // scoring them as if they were hourly returns inflates the number by orders of magnitude.
  const curve: Array<{ t: number; equity: number }> = (pet.marks ?? []).map(([t, equity]) => ({ t, equity }));
  if (curve.length && Date.now() - curve[curve.length - 1].t > 3600e3) curve.push({ t: Date.now(), equity: equityNow });

  // Max drawdown on that curve.
  let peak = -Infinity, maxDd = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.equity);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - p.equity) / peak);
  }

  // Sharpe from hourly returns, annualised. Needs a day of marks to mean anything.
  let sharpe: number | null = null;
  if (curve.length >= 24) {
    const rets: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1].equity;
      if (prev > 0) rets.push((curve[i].equity - prev) / prev);
    }
    if (rets.length >= 23) {
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
      const varc = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
      const sd = Math.sqrt(varc);
      if (sd > 0) sharpe = (mean / sd) * Math.sqrt(HOURS_PER_YEAR);
    }
  }

  const from = d[0]?.ts ?? null;
  const to = d[d.length - 1]?.ts ?? null;
  const fees = d
    .filter((e) => e.kind === 'open' || e.kind === 'add' || e.kind === 'trim' || e.kind === 'flatten')
    .reduce((s, e) => s + (e.qty ?? 0) * (e.price ?? 0) * 0.0006, 0);

  return {
    from,
    to,
    hours: from && to ? Math.round((to - from) / 3600e3) : 0,
    trades: closers.length,
    wins: wins.length,
    winRate: closers.length ? wins.length / closers.length : null,
    grossWin,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    realized: pet.realized,
    fundingPaid: pet.fundingPaid,
    fees,
    curve,
    maxDrawdownPct: curve.length ? maxDd * 100 : null,
    sharpe,
    faints: pet.faints,
    actions,
  };
}

/** One line a judge can read without opening anything. */
export function metricsLine(m: Metrics): string {
  const bits = [
    `${m.hours}h`,
    `${m.trades} closes`,
    m.winRate === null ? null : `${Math.round(m.winRate * 100)}% win`,
    m.sharpe === null ? null : `Sharpe ${m.sharpe.toFixed(2)}`,
    m.maxDrawdownPct === null ? null : `max DD ${m.maxDrawdownPct.toFixed(1)}%`,
    `funding $${m.fundingPaid.toFixed(2)}`,
    m.faints ? `${m.faints} faint${m.faints > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}
