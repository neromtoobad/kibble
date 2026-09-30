import { canonical, genesis, link, type ChainRow } from '../src/lib/chain';

// The hash chain survives what Postgres does to a row, and breaks on what a forger would do to one.
// No database needed: the round trip is simulated the way pg returns it — numeric columns as
// strings, jsonb with its keys reordered.

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `\n    ${detail}` : ''}`);
  if (!ok) failed++;
};

const pet = '8c4869ac-569a-45f4-8032-b8d03360e16c';
const rows: ChainRow[] = [
  { petId: pet, ts: 1790755643773, kind: 'sensed', body: 'Read 2 new items', qty: null, price: null, usd: null, execution: null, orderId: null, fillPrice: null, by: 'model',
    meta: { events: [{ title: 'NVIDIA beats estimates', kind: 'earnings', at: '2026-09-29T21:00', source: 'Yahoo' }] } },
  { petId: pet, ts: 1790755200000, kind: 'decided', body: 'Read 2 items and decided: open.', qty: null, price: null, usd: null, execution: null, orderId: null, fillPrice: null, by: 'model',
    meta: { model: 'qwen3.8-max', confidence: 0.82, cited: ['NVIDIA beats estimates'], action: 'open' } },
  { petId: pet, ts: 1790755200000, kind: 'open', body: 'Opened at 4×.', qty: 0.47474778134912644, price: 228.77, usd: 45.00000000000001, execution: 'demo', orderId: '1489087845955469313', fillPrice: 228.48, by: 'model',
    meta: { clampedBy: ['storm'], shadow: { side: 'buy', usd: 4.999999999999, lever: 4, price: 228.77, qty: 0.0874240 } } },
];

// Write: chain them.
let prev = genesis(pet);
const stored = rows.map((r) => { const hash = link(prev, r); const out = { ...r, hash, prev }; prev = hash; return out; });

// Read back the way pg returns it: numerics as strings, jsonb keys in another order.
const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse().map(([k, x]) => [k, reorder(x)])) : v;
const fromDb = stored.map((r) => ({
  ...r,
  qty: r.qty === null ? null : Number(String(r.qty)), price: r.price === null ? null : Number(String(r.price)),
  usd: r.usd === null ? null : Number(String(r.usd)), fillPrice: r.fillPrice === null ? null : Number(String(r.fillPrice)),
  meta: reorder(JSON.parse(JSON.stringify(r.meta))),
}));

const verify = (list: typeof fromDb) => {
  let p = genesis(pet);
  for (const [i, r] of list.entries()) {
    if (r.prev !== p || link(p, r) !== r.hash) return i;
    p = r.hash;
  }
  return -1;
};

check(verify(fromDb) === -1, 'a chain read back from the database verifies', `${fromDb.length} rows, head ${fromDb.at(-1)!.hash.slice(0, 16)}…`);
check(canonical({ ...rows[1], meta: { action: 'open', cited: ['NVIDIA beats estimates'], confidence: 0.82, model: 'qwen3.8-max' } }) === canonical(rows[1]),
  'key order inside meta does not change the hash');

const edited = fromDb.map((r, i) => (i === 1 ? { ...r, body: 'Read 2 items and decided: hold.' } : r));
check(verify(edited) === 1, 'editing one word of a decision breaks the chain at that row');
const priced = fromDb.map((r, i) => (i === 2 ? { ...r, fillPrice: 228.4 } : r));
check(verify(priced) === 2, 'moving a fill price by eight cents breaks it');
const dropped = [fromDb[0], fromDb[2]];
check(verify(dropped) === 1, 'dropping a row breaks it');
const swapped = [fromDb[1], fromDb[0], fromDb[2]];
check(verify(swapped) === 0, 'reordering rows breaks it');

console.log(failed ? `\n${failed} FAILED\n` : '\nall checks passed\n');
process.exit(failed ? 1 : 0);
