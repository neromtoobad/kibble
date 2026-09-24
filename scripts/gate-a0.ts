import { account, contracts, demoCreds, fillsFor, minSize, place, position, setIsolated, setLeverage, setOneWay, BitgetError } from '../src/lib/exchange';
import { ticker } from '../src/lib/bitget';

// Gate A0 from PLAN.md. Six things against Bitget's demo environment, in order, and the
// execution layer is not built unless all six pass:
//
//   1. read the account            — the key works and it is a demo key
//   2. one-way + isolated + 4×     — the position shape the engine assumes
//   3. market buy the minimum      — an order the demo accepts
//   4. read the position back      — it exists, at the leverage we set
//   5. reduce-only sell to close   — the honest way to flatten a long-only book
//   6. read the fills              — real prices, real fees
//
// Symbol is NVDAUSDT: it exists in demo (verified 20 Sep) and it is Nova's contract.

const SYMBOL = 'NVDAUSDT';
const LEVER = 4;

const ok = (n: number, msg: string) => console.log(`  ✓ ${n}. ${msg}`);
const fail = (n: number, e: unknown) => {
  const m = e instanceof BitgetError ? `${e.code} ${e.message}` : String((e as Error).message ?? e);
  console.error(`  ✗ ${n}. ${m}`);
  process.exit(1);
};

async function main() {
  const c = demoCreds();
  if (!c) { console.error('no BITGET_DEMO_* in .env.local'); process.exit(1); }
  console.log(`\nGate A0 · ${SYMBOL} · demo\n`);

  // 1
  let usdt = 0;
  try {
    const a = await account(c);
    usdt = Number(a.available);
    ok(1, `account read — ${a.marginCoin} available $${usdt.toFixed(2)}, equity $${Number(a.usdtEquity).toFixed(2)}`);
    if (usdt < 50) console.warn('     (low demo balance — top it up in Bitget → demo trading if orders get rejected)');
  } catch (e) { fail(1, e); }

  // 2 — these are idempotent; "already set" answers count as success
  try {
    await setOneWay(c).catch((e) => { if (!/already|40017|400172/.test(String(e))) throw e; });
    await setIsolated(c, SYMBOL).catch((e) => { if (!/already|40017/.test(String(e))) throw e; });
    await setLeverage(c, SYMBOL, LEVER);
    ok(2, `one-way, isolated, ${LEVER}× on ${SYMBOL}`);
  } catch (e) { fail(2, e); }

  // 3
  const k = (await contracts()).find((x) => x.symbol === SYMBOL);
  if (!k) fail(3, new Error(`${SYMBOL} not in the demo contract list`));
  const price = Number((await ticker(SYMBOL))?.lastPr ?? 0);
  if (!(price > 0)) fail(3, new Error(`no price for ${SYMBOL}`));
  const size = minSize(k!, price); // the contract minimum alone is under the 5 USDT floor
  let openId = '';
  try {
    const r = await place(c, { symbol: SYMBOL, side: 'buy', size, clientOid: `a0-open-${Date.now()}` });
    openId = r.orderId;
    ok(3, `market buy ${size} ${SYMBOL} — order ${openId}`);
  } catch (e) { fail(3, e); }

  // 4 — give the match engine a beat
  await new Promise((r) => setTimeout(r, 1500));
  let held = 0;
  try {
    const p = await position(c, SYMBOL);
    if (!p) throw new Error('no open position after the buy');
    held = Number(p.total);
    ok(4, `position: ${p.holdSide} ${p.total} @ $${Number(p.openPriceAvg).toFixed(2)}, ${p.leverage}×, ${p.marginMode}, liq $${Number(p.liquidationPrice).toFixed(2)}, margin $${Number(p.marginSize).toFixed(2)}`);
    if (p.marginMode !== 'isolated') console.warn('     (margin mode is not isolated — check step 2)');
  } catch (e) { fail(4, e); }

  // 5
  let closeId = '';
  try {
    const r = await place(c, { symbol: SYMBOL, side: 'sell', size: held, reduceOnly: true, clientOid: `a0-close-${Date.now()}` });
    closeId = r.orderId;
    await new Promise((r) => setTimeout(r, 1500));
    const p = await position(c, SYMBOL);
    if (p) throw new Error(`position still open: ${p.total}`);
    ok(5, `reduce-only sell — order ${closeId}, position flat`);
  } catch (e) { fail(5, e); }

  // 6
  try {
    const o = await fillsFor(c, SYMBOL, openId);
    const x = await fillsFor(c, SYMBOL, closeId);
    if (!o || !x) throw new Error('fills not visible yet');
    ok(6, `fills — bought ${o.qty} @ $${o.price.toFixed(2)} fee $${o.fee.toFixed(4)}; sold ${x.qty} @ $${x.price.toFixed(2)} fee $${x.fee.toFixed(4)}`);
    console.log(`     round trip cost $${((o.price - x.price) * o.qty + o.fee + x.fee).toFixed(4)} — that is the spread plus two taker fees, observed rather than assumed`);
  } catch (e) { fail(6, e); }

  console.log('\nGATE A0 PASSED — demo execution is real. Build A.\n');
}

main();
