// Bitget public market data — everything a Stockling sees. USDT-FUTURES is where
// Bitget lists tokenized US stocks (rTokens) as perpetuals: they trade 24/7 while
// the shares behind them trade 6.5 hours a day, which is the whole premise of this
// app. No key, no account; the pet only needs to read.

const BASE = process.env.BITGET_REST_BASE ?? 'https://api.bitget.com';
const PRODUCT = 'USDT-FUTURES';

type Envelope<T> = { code?: string; msg?: string; data?: T };

async function get<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { next: { revalidate }, headers: { Accept: 'application/json' } });
    const j = (await r.json()) as Envelope<T>;
    if (!r.ok || j.code !== '00000') return null;
    return j.data ?? null;
  } catch {
    return null;
  }
}

export const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(x) ? x : null;
};

// ── contracts ─────────────────────────────────────────────────────────

export type Contract = {
  symbol: string;        // NVDAUSDT
  baseCoin: string;      // NVDA
  isRwa?: 'YES' | 'NO';  // tokenized real-world asset
  symbolStatus: string;
  maxLever?: string;
  minTradeUSDT?: string;
  fundInterval?: string; // hours between funding settlements
  takerFeeRate?: string;
};

/** Every tokenized-stock perpetual Bitget lists right now. Cached an hour. */
export async function rwaContracts(): Promise<Contract[]> {
  const all = await get<Contract[]>(`/api/v2/mix/market/contracts?productType=${PRODUCT}`, 3600);
  return (all ?? []).filter((c) => c.isRwa === 'YES' && c.symbolStatus === 'normal');
}

export async function contractFor(symbol: string): Promise<Contract | null> {
  const all = await get<Contract[]>(`/api/v2/mix/market/contracts?productType=${PRODUCT}&symbol=${symbol}`, 3600);
  return all?.[0] ?? null;
}

// ── ticker ────────────────────────────────────────────────────────────

export type Ticker = {
  symbol: string;
  lastPr: string;
  markPrice: string;
  indexPrice: string;   // the underlying's reference — what the share is worth
  change24h: string;    // fraction
  high24h: string;
  low24h: string;
  usdtVolume: string;
  fundingRate: string;  // per interval, fraction
  holdingAmount: string;
};

export async function ticker(symbol: string): Promise<Ticker | null> {
  const d = await get<Ticker[]>(`/api/v2/mix/market/ticker?symbol=${symbol}&productType=${PRODUCT}`, 30);
  return d?.[0] ?? null;
}

export async function allTickers(): Promise<Ticker[]> {
  return (await get<Ticker[]>(`/api/v2/mix/market/tickers?productType=${PRODUCT}`, 30)) ?? [];
}

// ── candles ───────────────────────────────────────────────────────────

/** [ts, open, high, low, close, baseVol, quoteVol] — all strings, ascending. */
type Candle = [string, string, string, string, string, string, string];
export type Bar = { t: number; open: number; high: number; low: number; close: number };

const toBar = (c: Candle): Bar | null => {
  const [t, o, h, l, cl] = c.map(n);
  return t === null || o === null || h === null || l === null || cl === null ? null : { t, open: o, high: h, low: l, close: cl };
};

/** Recent hourly bars, ascending. Bitget caps a page at 1000. */
export async function candles(symbol: string, hours = 200, granularity = '1H'): Promise<Bar[]> {
  const d = await get<Candle[]>(`/api/v2/mix/market/candles?symbol=${symbol}&granularity=${granularity}&productType=${PRODUCT}&limit=${Math.min(hours, 1000)}`, 300);
  return (d ?? []).map(toBar).filter((b): b is Bar => b !== null);
}

/** Deep history, paging backwards from `endTime`. 200 per page. */
export async function historyCandles(symbol: string, endTime?: number, granularity = '1H'): Promise<Bar[]> {
  const tail = endTime === undefined ? '' : `&endTime=${endTime}`;
  const d = await get<Candle[]>(`/api/v2/mix/market/history-candles?symbol=${symbol}&granularity=${granularity}&productType=${PRODUCT}&limit=200${tail}`, 3600);
  return (d ?? []).map(toBar).filter((b): b is Bar => b !== null);
}

// ── funding ───────────────────────────────────────────────────────────

export type Funding = { rate: number; intervalHours: number; nextAt: number | null };

/** The rate a position pays (or receives) at the next settlement. Longs pay a positive rate. */
export async function funding(symbol: string): Promise<Funding | null> {
  const d = await get<Array<{ fundingRate: string; fundingRateInterval: string; nextUpdate: string }>>(
    `/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=${PRODUCT}`,
    120,
  );
  const f = d?.[0];
  if (!f) return null;
  return { rate: n(f.fundingRate) ?? 0, intervalHours: n(f.fundingRateInterval) ?? 8, nextAt: n(f.nextUpdate) };
}

/** Settled funding history, newest first — what the pet actually paid over a window. */
export async function fundingHistory(symbol: string, pageSize = 100): Promise<Array<{ t: number; rate: number }>> {
  const d = await get<Array<{ fundingRate: string; fundingTime: string }>>(
    `/api/v2/mix/market/history-fund-rate?symbol=${symbol}&productType=${PRODUCT}&pageSize=${pageSize}`,
    3600,
  );
  return (d ?? [])
    .map((f) => ({ t: n(f.fundingTime) ?? 0, rate: n(f.fundingRate) ?? 0 }))
    .filter((f) => f.t > 0)
    .sort((a, b) => a.t - b.t);
}
