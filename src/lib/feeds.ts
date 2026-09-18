import { SPECIES, type Species } from './pets';

// What the pet can smell. Three free, keyless, official-ish sources: Yahoo Finance's per-ticker
// RSS and Google News for what was said, and SEC EDGAR for what was actually filed. An 8-K
// carrying item 2.02 is an earnings release — exact and dated, not a vendor's opinion.
//
// This is the "sense" half of sense → judge → act. It returns dated facts and never a number
// derived from them: the model does the interpreting, and it has to cite what it read.
//
// Two of the six species are pre-IPO (OPENAI, SPCX). They have no CIK and no Yahoo ticker, so
// filings come back empty and only the news search answers — which is itself honest: there is
// less to know about a company that does not have to tell you anything.

const UA = 'Mozilla/5.0 (compatible; night-shift/1.0)';
// EDGAR throttles anonymous agents and asks for a contact.
const SEC_UA = 'night-shift hackathon agent (dimejikeji5@gmail.com)';
const TIMEOUT = 10_000;

export type SensedEvent = {
  kind: 'headline' | 'filing' | 'earnings';
  title: string;
  at: string | null;      // ISO, when it happened
  source: string | null;
  url: string | null;
};

const COMPANY: Record<string, string> = {
  NVDA: 'Nvidia', TSLA: 'Tesla', AAPL: 'Apple',
  SPCX: 'SpaceX', OPENAI: 'OpenAI', RDDT: 'Reddit',
};

async function get(url: string, ua: string, revalidate: number): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': ua, Accept: 'application/json, application/rss+xml, application/xml, text/xml' },
      next: { revalidate },
    } as RequestInit);
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// ── headlines ─────────────────────────────────────────────────────────

/** RSS carries HTML entities, so the model was being shown "S&amp;P 500" and similar. */
function decodeEntities(t: string): string {
  return t
    .replace(/&(?:amp|#38);/g, '&')
    .replace(/&(?:lt|#60);/g, '<')
    .replace(/&(?:gt|#62);/g, '>')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39|#x27);/g, "'")
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseRss(xml: string, feed: 'yahoo' | 'google'): SensedEvent[] {
  const out: SensedEvent[] = [];
  for (const it of xml.split(/<item[\s>]/).slice(1)) {
    const pick = (tag: string) => {
      const m = it.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i'));
      return m ? m[1].trim() : null;
    };
    const title = pick('title');
    if (!title) continue;
    const pub = pick('pubDate');
    const d = pub ? new Date(pub) : null;
    out.push({
      kind: 'headline',
      // Google News appends " - Source" to every title.
      title: decodeEntities(feed === 'google' ? title.replace(/\s-\s[^-]+$/, '') : title),
      at: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      source: decodeEntities(pick('source') ?? (feed === 'google' ? title.split(' - ').pop() ?? '' : 'Yahoo Finance')) || null,
      url: pick('link'),
    });
  }
  return out;
}

async function headlines(ticker: string, company: string): Promise<SensedEvent[]> {
  const [y, g] = await Promise.all([
    get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`, UA, 600),
    get(`https://news.google.com/rss/search?q=${encodeURIComponent(`${company} stock`)}&hl=en-US&gl=US&ceid=US:en`, UA, 600),
  ]);
  const all = [
    ...(y ? parseRss(await y.text(), 'yahoo') : []),
    ...(g ? parseRss(await g.text(), 'google') : []),
  ];
  const seen = new Set<string>();
  return all.filter((h) => {
    const k = h.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── SEC EDGAR ─────────────────────────────────────────────────────────

type TickerMap = Record<string, { cik_str: number; ticker: string; title: string }>;
type Submissions = {
  filings?: { recent?: { form?: string[]; filingDate?: string[]; items?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
};

async function filings(ticker: string): Promise<SensedEvent[]> {
  const mapRes = await get('https://www.sec.gov/files/company_tickers.json', SEC_UA, 86_400);
  if (!mapRes) return [];
  const map = (await mapRes.json()) as TickerMap;
  const want = ticker.toUpperCase();
  const hit = Object.values(map).find((v) => v.ticker?.toUpperCase() === want);
  if (!hit) return []; // pre-IPO, or not a US filer

  const cik = String(hit.cik_str).padStart(10, '0');
  const subRes = await get(`https://data.sec.gov/submissions/CIK${cik}.json`, SEC_UA, 21_600);
  if (!subRes) return [];
  const r = ((await subRes.json()) as Submissions).filings?.recent;
  if (!r?.form) return [];

  const out: SensedEvent[] = [];
  for (let i = 0; i < r.form.length && out.length < 6; i++) {
    const form = r.form[i];
    if (!['8-K', '10-Q', '10-K'].includes(form)) continue;
    const items = r.items?.[i] || null;
    const earnings = form === '8-K' && /(^|,)2\.02(,|$)/.test(items ?? '');
    const acc = (r.accessionNumber?.[i] ?? '').replace(/-/g, '');
    out.push({
      kind: earnings ? 'earnings' : 'filing',
      title: earnings ? `${form} item 2.02 — results of operations (earnings release)` : `${form} filed${items ? ` — items ${items}` : ''}`,
      at: r.filingDate?.[i] ? `${r.filingDate[i]}T00:00:00.000Z` : null,
      source: 'SEC EDGAR',
      url: `https://www.sec.gov/Archives/edgar/data/${hit.cik_str}/${acc}/${r.primaryDocument?.[i] ?? ''}`,
    });
  }
  return out;
}

// ── what the pet sensed ───────────────────────────────────────────────

/**
 * Everything dated that has happened to this company, newest first. `since` keeps the model
 * from re-reading what it has already judged — the agent should act on news, not on the fact
 * that the news is still there.
 *
 * Headlines and filings get separate quotas rather than competing on recency. A pure date sort
 * looked right and was wrong: a filing is stamped with a date and no time, so every listicle
 * published this morning outranked an 8-K item 2.02 from three weeks ago. That is exactly
 * backwards for deciding anything, and it silently starved the model of the only source here
 * that is authoritative.
 */
export async function sense(species: Species['id'], since = 0): Promise<SensedEvent[]> {
  const sp = SPECIES[species];
  const company = COMPANY[sp.ticker] ?? sp.ticker;
  const [news, docs] = await Promise.all([
    headlines(sp.ticker, company).catch(() => []),
    filings(sp.ticker).catch(() => []),
  ]);
  const fresh = (list: SensedEvent[]) =>
    list.filter((e) => !e.at || new Date(e.at).getTime() > since)
        .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  // Earnings releases first — they are the one thing here the company had to say.
  const filed = fresh(docs);
  return [
    ...filed.filter((e) => e.kind === 'earnings').slice(0, 2),
    ...filed.filter((e) => e.kind === 'filing').slice(0, 2),
    ...fresh(news).slice(0, 8),
  ];
}
