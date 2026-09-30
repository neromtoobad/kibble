import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Every stock a pet can be adopted on: Bitget's tokenized-stock (RWA) perpetuals that trade enough
// to paper-trade honestly, each given a species family by what the company does.
//
//   node scripts/build-universe.mjs [cacheDir]
//
// Sources, all public and keyless:
//   Bitget  /api/v2/mix/market/contracts + /tickers (USDT-FUTURES) — isRwa, maxLever, 24h volume
//   Nasdaq  api.nasdaq.com screener, stocks and ETFs — sector, industry, country, company name
// With a cacheDir the four responses are read from contracts.json, tickers.json, nasdaq-stocks.json
// and nasdaq-etf.json instead (bitget.com is unreachable from some networks; the build machine for
// this snapshot was one of them).
//
// The output is a checked-in snapshot, src/data/universe.json, not a live query: which animal a
// company is should not change between two ticks, and the worker should not need Nasdaq to run.
// Leverage is clamped again at order time against the live contract, so a stale ceiling can only
// ever be too cautious (see lib/execute.ts).

const MIN_VOLUME = 250_000; // USDT per 24h. Below this the hourly bars are gappy and a paper fill at the close is fiction.

// The six founders already have a pet each; their tickers resolve to them, not to a second entry.
const FOUNDERS = new Set(['NVDA', 'TSLA', 'AAPL', 'SPCX', 'OPENAI', 'RDDT']);

// Private companies whose perpetual is the only market there is. Only the ones priced off a US
// valuation; Chinese pre-IPO names settle against Hong Kong listings and don't keep US hours.
const PRIVATE = { ANTHROPIC: { company: 'Anthropic', family: 'nimbus' } };

// US index perpetuals: they move only when the index does, so they keep the NYSE clock.
const INDEX = { SP500: 'S&P 500', NDX100: 'Nasdaq-100' };

// Where the sector rule below lands a company in the wrong family: either Nasdaq's industry label is
// off (GE Aerospace filed under consumer electronics, Ciena under utilities) or the business that
// moves the stock isn't the one it files under (a bitcoin treasury files as software).
const OVERRIDE = {
  // crypto first: treasuries, miners, exchanges, a stablecoin issuer
  MSTR: 'hodl', COIN: 'hodl', CRCL: 'hodl', BMNR: 'hodl', MARA: 'hodl', IREN: 'hodl', PURR: 'hodl', BNC: 'hodl',
  GE: 'booster', ASTS: 'booster',            // jet engines; satellite broadband
  TEM: 'dose',                               // clinical data and diagnostics
  META: 'lurk', GOOGL: 'lurk', BZ: 'lurk',   // ads, search, social, online recruiting
  PANW: 'nimbus', IBM: 'nimbus',             // security software; cloud and consulting
  IONQ: 'nova', AEHR: 'nova', CIEN: 'nova',  // quantum hardware; chip test gear; optical networking
  GPRO: 'pip',                               // cameras
  BE: 'volt', FLNC: 'volt', SMR: 'volt',     // fuel cells; grid batteries; small reactors
  ETN: 'rivet', VRT: 'rivet',                // electrical equipment; data-centre power and cooling
};

function familyOf(ticker, sector, industry) {
  if (OVERRIDE[ticker]) return OVERRIDE[ticker];
  const i = (industry ?? '').toLowerCase();
  switch (sector) {
    case 'Technology':
      if (/semiconductor|electronic components/.test(i)) return 'nova';
      if (/computer manufacturing|peripheral|consumer electronics|retail: computer/.test(i)) return 'pip';
      if (/software|edp|programming|data processing/.test(i)) return 'nimbus';
      return 'nova';
    case 'Telecommunications': return /equipment/.test(i) ? 'nova' : 'lurk';
    case 'Health Care': return 'dose';
    case 'Finance': case 'Real Estate': return 'ledger';
    case 'Energy': case 'Basic Materials': return 'crude';
    case 'Utilities': return 'volt';
    case 'Consumer Discretionary':
      if (/auto/.test(i)) return 'volt';
      if (/broadcast|movies|entertainment|publishing|advertising/.test(i)) return 'lurk';
      return 'tote';
    case 'Consumer Staples': return 'tote';
    case 'Industrials':
      if (/aerospace|military|defense/.test(i)) return 'booster';
      if (/auto manufacturing/.test(i)) return 'volt';
      return 'rivet';
    default: return 'rivet';
  }
}

// Leveraged, inverse and volatility ETFs rebalance daily; a pet holding one is holding leverage on
// leverage, which is exactly what the mandates exist to prevent.
const GEARED = /(\b[23]x\b|-[123]x\b|leverag|inverse|ultra|\bbear\b|\bbull\b|daily|\bshort\b|\bvix\b|volatility)/i;

const tidy = (name) => {
  let s = name.replace(/\s*\(The\)/, '').replace(/\s+(Common Stock|Class [A-C]\b|American Depositary|Ordinary Shares|Depositary|Capital Stock|New York Registry).*$/i, '');
  for (let k = 0; k < 3; k++) s = s.replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.|Ltd\.?|Limited|plc|N\.V\.|S\.A\.|SE|Holdings?|Group)$/i, '');
  return s.trim();
};

// Nasdaq prefixes the issuing trust ("iShares Inc iShares MSCI Japan ETF"); keep the fund's own name.
const etfName = (name) => {
  const n = name.replace(/^(iShares Inc|iShares Trust|KraneShares Trust|Roundhill ETF Trust|VanEck ETF Trust)\s+/i, '');
  const end = n.search(/\s(ETF|Fund|Trust)\b[^]*$/i);
  return end > 0 ? n.slice(0, end) + ' ETF' : n;
};

async function load(dir) {
  const read = async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'));
  if (dir) return { contracts: await read('contracts.json'), tickers: await read('tickers.json'), stocks: await read('nasdaq-stocks.json'), etfs: await read('nasdaq-etf.json') };
  const bg = async (p) => (await (await fetch(`https://api.bitget.com/api/v2/mix/market/${p}?productType=USDT-FUTURES`)).json()).data;
  const nq = async (p) => (await fetch(`https://api.nasdaq.com/api/screener/${p}?tableonly=true&download=true`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126 Safari/537.36', Accept: 'application/json' },
  })).json();
  return { contracts: await bg('contracts'), tickers: await bg('tickers'), stocks: await nq('stocks'), etfs: await nq('etf') };
}

const { contracts, tickers, stocks, etfs } = await load(process.argv[2]);
const vol = new Map(tickers.map((t) => [t.symbol, Number(t.usdtVolume || t.quoteVolume || 0)]));
const stock = new Map(stocks.data.rows.map((r) => [r.symbol.replace('/', '.'), r]));
const etf = new Map((etfs.data.data?.rows ?? etfs.data.rows).map((r) => [r.symbol, r]));

const listings = [];
const skipped = { thin: 0, founder: 0, geared: [], other: [] };
for (const k of contracts) {
  if (k.isRwa !== 'YES' || k.symbolStatus !== 'normal' || !k.symbol.endsWith('USDT')) continue;
  const t = k.baseCoin, v = vol.get(k.symbol) ?? 0;
  if (v < MIN_VOLUME) { skipped.thin++; continue; }
  if (FOUNDERS.has(t)) { skipped.founder++; continue; }
  const base = { id: t, ticker: t, symbol: k.symbol, maxLever: Number(k.maxLever), volume24h: Math.round(v) };
  const s = stock.get(t), e = etf.get(t);
  if (s) listings.push({ ...base, company: tidy(s.name), family: familyOf(t, s.sector, s.industry), kind: 'stock', preIpo: false, sector: s.sector || null, industry: s.industry || null });
  else if (e && GEARED.test(e.companyName)) skipped.geared.push(t);
  else if (e) listings.push({ ...base, company: etfName(e.companyName), family: 'basket', kind: 'etf', preIpo: false, sector: null, industry: null });
  else if (INDEX[t]) listings.push({ ...base, company: INDEX[t], family: 'basket', kind: 'index', preIpo: false, sector: null, industry: null });
  else if (PRIVATE[t]) listings.push({ ...base, ...PRIVATE[t], kind: 'private', preIpo: true, sector: null, industry: null });
  else skipped.other.push(t);
}
listings.sort((a, b) => b.volume24h - a.volume24h);

const out = {
  asOf: new Date(Math.max(...tickers.map((t) => Number(t.ts) || 0))).toISOString(),
  minVolume24h: MIN_VOLUME,
  note: 'Generated by scripts/build-universe.mjs from Bitget contracts/tickers and the Nasdaq screener. Do not edit by hand; change the rules and rebuild.',
  listings,
};
await mkdir('src/data', { recursive: true });
await writeFile('src/data/universe.json', JSON.stringify(out, null, 1) + '\n');

const by = {};
for (const l of listings) (by[l.family] ??= []).push(l.ticker);
console.log(`${listings.length} listings (plus ${skipped.founder} founders) · ${skipped.thin} below $${MIN_VOLUME / 1e3}k/day`);
for (const [f, ts] of Object.entries(by).sort()) console.log(`  ${f.padEnd(8)} ${String(ts.length).padStart(3)}  ${ts.join(' ')}`);
console.log(`  geared ETFs left out: ${skipped.geared.join(' ')}`);
console.log(`  not US-listed / not a stock: ${skipped.other.join(' ')}`);
