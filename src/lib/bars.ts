import { SPECIES, type Species } from './pets';
import { candles, historyCandles, fundingHistory, type Bar } from './bitget';

// Hourly bars and settled funding for a species' home perpetual, shared by the history route
// and the hourly worker so the pet reacts to the same tape whether or not anyone has the app
// open. Bitget's public market data needs no auth.
//
// Unlike a share, this tape never stops: the rToken perpetual prints through the night, the
// weekend and every holiday. That is the whole reason these creatures have a night shift.

export type BarSet = { bars: Bar[]; funding: Array<{ t: number; rate: number }>; source: 'bitget' | 'none' };

export async function fetchBars(id: Species['id'], days = 14): Promise<BarSet> {
  const sp = SPECIES[id];
  if (!sp) return { bars: [], funding: [], source: 'none' };

  const want = Date.now() - days * 86400e3;
  const rows = new Map<number, Bar>();
  for (const b of await candles(sp.symbol, 1000)) rows.set(b.t, b);

  // Page back only as far as the window needs — a fresh pet wants a fortnight, not a year.
  let oldest = rows.size ? Math.min(...rows.keys()) : Date.now();
  for (let i = 0; i < 8 && oldest > want; i++) {
    const page = await historyCandles(sp.symbol, oldest);
    if (!page.length) break;
    for (const b of page) rows.set(b.t, b);
    oldest = Math.min(...page.map((b) => b.t));
  }

  const bars = [...rows.values()].sort((a, b) => a.t - b.t).filter((b) => b.t >= want);
  const funding = await fundingHistory(sp.symbol, 200);
  return { bars, funding, source: bars.length ? 'bitget' : 'none' };
}

export type { Bar };
