import { createHmac } from 'node:crypto';

// Bitget's demo trading environment, and nothing else.
//
// Every request this module makes carries `paptrading: 1`, which routes it to Bitget's demo
// (paper) environment. There is deliberately no flag, env var or code path that omits that
// header: a key configured here can only ever move demo funds. The handbook's own recommended
// route to a Track 2 paper-trading log is exactly this — a Demo API key against the demo
// environment — so the log's fills, positions and funding come from the exchange rather than
// from our simulation.
//
// Auth is Bitget's v2 scheme: ACCESS-SIGN is base64(HMAC-SHA256(secret, ts + METHOD + path +
// body)). Signed here, locally; the secret never leaves the process.
//
// Positions are isolated and one-way. Isolated so each species' margin is its own — one pet
// fainting cannot take another's margin with it. One-way so an order is just buy or sell and
// closing is `reduceOnly`, which is the honest shape for something that is long-only.

const BASE = 'https://api.bitget.com';
export const PRODUCT = 'USDT-FUTURES';
const COIN = 'USDT';

export type Creds = { key: string; secret: string; passphrase: string };

export function demoCreds(): Creds | null {
  const key = process.env.BITGET_DEMO_KEY, secret = process.env.BITGET_DEMO_SECRET, passphrase = process.env.BITGET_DEMO_PASSPHRASE;
  return key && secret && passphrase ? { key, secret, passphrase } : null;
}
export const hasExchange = () => demoCreds() !== null;

export class BitgetError extends Error {
  constructor(public code: string, msg: string, public path: string) { super(`${path} → ${code}: ${msg}`); }
}

async function call<T>(c: Creds, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
  const ts = String(Date.now());
  const payload = body ? JSON.stringify(body) : '';
  const sign = createHmac('sha256', c.secret).update(ts + method + path + payload).digest('base64');
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      'ACCESS-KEY': c.key,
      'ACCESS-SIGN': sign,
      'ACCESS-TIMESTAMP': ts,
      'ACCESS-PASSPHRASE': c.passphrase,
      'Content-Type': 'application/json',
      locale: 'en-US',
      paptrading: '1', // never conditional
    },
    body: payload || undefined,
  });
  const j = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  if (!res.ok || j.code !== '00000') throw new BitgetError(j.code ?? String(res.status), j.msg ?? res.statusText, path);
  return j.data as T;
}

const q = (o: Record<string, string>) => '?' + new URLSearchParams(o).toString();

// ── account ───────────────────────────────────────────────────────────

export type Account = { marginCoin: string; available: string; usdtEquity: string; unrealizedPL: string; locked: string };

export const account = (c: Creds) =>
  call<Account[]>(c, 'GET', `/api/v2/mix/account/accounts${q({ productType: PRODUCT })}`).then((a) => a.find((x) => x.marginCoin === COIN) ?? a[0]);

export const setOneWay = (c: Creds) =>
  call(c, 'POST', '/api/v2/mix/account/set-position-mode', { productType: PRODUCT, posMode: 'one_way_mode' });

export const setIsolated = (c: Creds, symbol: string) =>
  call(c, 'POST', '/api/v2/mix/account/set-margin-mode', { symbol, productType: PRODUCT, marginCoin: COIN, marginMode: 'isolated' });

export const setLeverage = (c: Creds, symbol: string, leverage: number) =>
  call(c, 'POST', '/api/v2/mix/account/set-leverage', { symbol, productType: PRODUCT, marginCoin: COIN, leverage: String(leverage) });

// ── contracts ─────────────────────────────────────────────────────────

export type Contract = { symbol: string; minTradeNum: string; sizeMultiplier: string; volumePlace: string; pricePlace: string; maxLever: string; symbolStatus: string };

/** Public, but read through the demo header so it is the demo list — not every contract is there. */
export async function contracts(): Promise<Contract[]> {
  const res = await fetch(`${BASE}/api/v2/mix/market/contracts${q({ productType: PRODUCT })}`, { headers: { paptrading: '1' }, signal: AbortSignal.timeout(15_000) });
  const j = (await res.json()) as { data: Contract[] };
  return j.data ?? [];
}

/** Round a size down to what the contract will accept, or 0 if it is under the minimum. */
export function roundSize(size: number, k: Contract): number {
  const step = Number(k.sizeMultiplier) || Math.pow(10, -Number(k.volumePlace || 0));
  const r = Math.floor(size / step + 1e-9) * step;
  const fixed = Number(r.toFixed(Number(k.volumePlace || 4)));
  return fixed >= Number(k.minTradeNum) ? fixed : 0;
}

/** Bitget refuses any order worth under 5 USDT (45110), whatever the contract's minimum quantity. */
export const MIN_NOTIONAL = 5;

/**
 * The smallest size an order can be at `price`: the contract's minimum quantity or 5 USDT's worth,
 * whichever is larger, rounded UP to the size step. 0.01 NVDA is about $2.30 — a valid quantity
 * and a rejected order.
 */
export function minSize(k: Contract, price: number): number {
  const step = Number(k.sizeMultiplier) || Math.pow(10, -Number(k.volumePlace || 0));
  const want = Math.max(Number(k.minTradeNum), (MIN_NOTIONAL * 1.1) / price);
  return Number((Math.ceil(want / step - 1e-9) * step).toFixed(Number(k.volumePlace || 4)));
}

// ── position & orders ─────────────────────────────────────────────────

export type Position = {
  symbol: string; holdSide: 'long' | 'short'; total: string; available: string;
  openPriceAvg: string; marginSize: string; leverage: string; liquidationPrice: string;
  unrealizedPL: string; marginMode: string;
};

export const position = (c: Creds, symbol: string) =>
  call<Position[]>(c, 'GET', `/api/v2/mix/position/single-position${q({ symbol, productType: PRODUCT, marginCoin: COIN })}`)
    .then((p) => p.find((x) => Number(x.total) > 0) ?? null);

export type Placed = { orderId: string; clientOid: string };

/**
 * A market order. `reduceOnly` is how a long is closed in one-way mode; without it a sell on a
 * flat book would open a short, which this system has no concept of.
 */
export const place = (c: Creds, o: { symbol: string; side: 'buy' | 'sell'; size: number; reduceOnly?: boolean; clientOid?: string }) =>
  call<Placed>(c, 'POST', '/api/v2/mix/order/place-order', {
    symbol: o.symbol, productType: PRODUCT, marginMode: 'isolated', marginCoin: COIN,
    size: String(o.size), side: o.side, orderType: 'market',
    ...(o.reduceOnly ? { reduceOnly: 'YES' } : {}),
    ...(o.clientOid ? { clientOid: o.clientOid } : {}),
  });

export type Fill = { orderId: string; tradeId: string; symbol: string; side: string; price: string; baseVolume: string; quoteVolume: string; feeDetail?: Array<{ totalFee: string }>; cTime: string };

export const fills = (c: Creds, symbol: string, limit = 20) =>
  call<{ fillList: Fill[] }>(c, 'GET', `/api/v2/mix/order/fills${q({ symbol, productType: PRODUCT, limit: String(limit) })}`).then((r) => r.fillList ?? []);

/** Fills for one order — what actually happened, at what price, for what fee. */
export async function fillsFor(c: Creds, symbol: string, orderId: string): Promise<{ price: number; qty: number; fee: number } | null> {
  const list = await fills(c, symbol, 50);
  const mine = list.filter((f) => f.orderId === orderId);
  if (!mine.length) return null;
  const qty = mine.reduce((s, f) => s + Number(f.baseVolume), 0);
  const notional = mine.reduce((s, f) => s + Number(f.quoteVolume), 0);
  const fee = mine.reduce((s, f) => s + (f.feeDetail ?? []).reduce((t, d) => t + Math.abs(Number(d.totalFee)), 0), 0);
  return { price: qty ? notional / qty : 0, qty, fee };
}
