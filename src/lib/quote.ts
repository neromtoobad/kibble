// The live print for a Stockling's home perpetual, plus the two numbers that only a
// perpetual has: what it costs to hold, and what the underlying share is worth right now.
import { SPECIES, bySymbol } from './pets';
import { allTickers, n } from './bitget';

const TTL = 30_000;
let cache: { at: number; rows: Map<string, Quote> } | null = null;

export type Quote = {
  ticker: string;
  symbol: string;
  price: number | null;       // the perpetual's last trade
  indexPrice: number | null;  // the underlying share's reference price
  pct24h: number;             // percent
  fundingRate: number;        // per 8h, fraction; positive = longs pay
  /** (perp − index) / index × 100 — how far the perpetual sits from the share it tracks. */
  basisPct: number | null;
};

/** One call prices every species. */
export async function quotes(): Promise<Map<string, Quote>> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;
  const rows = new Map<string, Quote>();
  for (const t of await allTickers()) {
    const sp = bySymbol(t.symbol);
    if (!sp) continue;
    const price = n(t.lastPr);
    const index = n(t.indexPrice);
    rows.set(sp.ticker, {
      ticker: sp.ticker,
      symbol: sp.symbol,
      price,
      indexPrice: index,
      pct24h: (n(t.change24h) ?? 0) * 100,
      fundingRate: n(t.fundingRate) ?? 0,
      basisPct: price !== null && index ? ((price - index) / index) * 100 : null,
    });
  }
  if (rows.size) cache = { at: Date.now(), rows };
  return rows;
}

export async function quoteFor(ticker: string): Promise<Quote | null> {
  return (await quotes()).get(ticker) ?? null;
}

export async function priceFor(ticker: string): Promise<number | null> {
  return (await quoteFor(ticker))?.price ?? null;
}

export async function pricesFor(tickers: string[]): Promise<Record<string, number | null>> {
  const q = await quotes();
  return Object.fromEntries([...new Set(tickers)].map((t) => [t, q.get(t)?.price ?? null]));
}

export { SPECIES };
