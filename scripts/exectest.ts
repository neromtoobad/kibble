import { openBook, trade } from '../src/lib/execute';
import { place, position } from '../src/lib/exchange';
import { ticker } from '../src/lib/bitget';
import type { Entry, PetState } from '../src/lib/pet-math';

// The execution layer, end to end, against Bitget's demo exchange. Needs BITGET_DEMO_* in
// .env.local and a funded demo futures account; it moves demo funds only, and leaves the NVDAUSDT
// demo position flat when it finishes.
//
// Five ticks, each checked against what the exchange says it holds afterwards:
//   1. cutover  — the pet already holds 0.50 in the simulation; the exchange mirrors it
//   2. add      — the engine adds 0.20; the order goes out and the row gets its order id and fill
//   3. trim     — the engine trims 0.35; reduce-only
//   4. drift    — someone buys 0.05 behind the engine's back; the square-up sells it
//   5. flatten  — the engine closes; the exchange ends flat

const SYMBOL = 'NVDAUSDT';
let failed = 0;
const check = (ok: boolean, what: string, detail: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}\n    ${detail}`);
  if (!ok) failed++;
};

async function main() {
  const { book, note } = await openBook();
  if (!book) { console.error(note ?? 'no BITGET_DEMO_* configured'); process.exit(1); }
  const price = Number((await ticker(SYMBOL))?.lastPr ?? 0);
  const held = async () => Number((await position(book.creds, SYMBOL))?.total ?? 0);
  if (await held()) { console.error(`${SYMBOL} demo position is not flat to start with — close it first`); process.exit(1); }

  const pet = (qty: number): PetState => ({
    species: 'nova', name: 'Nova', personality: 'owl', adoptedAt: 0, lastFed: 0, streak: 1, lastVisitDay: '',
    margin: 50, position: qty > 0 ? { qty, entry: price, openedAt: 0 } : null,
    realized: 0, fundingPaid: 0, faints: 0, lastTickAt: 0, marks: [], diary: [],
  });
  const row = (kind: Entry['kind'], qty: number): Entry => ({ ts: Date.now(), kind, text: kind, qty, price, paper: true });
  const show = (fresh: Entry[]) => fresh.map((e) =>
    `${e.kind}${e.order ? ` order ${e.order}` : ''}${e.fill ? ` fill $${e.fill.toFixed(2)} vs bar $${price.toFixed(2)}` : ''}${e.kind === 'system' ? ` — ${e.text}` : ''}`).join('\n    ');

  let fresh: Entry[] = [];
  const cut = await trade(book, pet(0.5), fresh, false, Date.now(), price);
  check(cut && (await held()) === 0.5, 'cutover mirrors the simulated position onto the exchange', show(fresh));

  fresh = [row('add', 0.2)];
  await trade(book, pet(0.7), fresh, true, Date.now(), price);
  check(Boolean(fresh[0].order && fresh[0].fill) && (await held()) === 0.7, 'an add goes out as a market buy and the row keeps the order id and fill', show(fresh));

  fresh = [row('trim', 0.35)];
  await trade(book, pet(0.35), fresh, true, Date.now(), price);
  check(Boolean(fresh[0].order) && (await held()) === 0.35, 'a trim goes out reduce-only', show(fresh));

  await place(book.creds, { symbol: SYMBOL, side: 'buy', size: 0.05 });
  await new Promise((r) => setTimeout(r, 1500));
  fresh = [];
  await trade(book, pet(0.35), fresh, true, Date.now(), price);
  check((await held()) === 0.35 && fresh.some((e) => e.kind === 'system' && e.order), 'drift behind the engine\'s back is squared up, and the correction is written down', show(fresh));

  fresh = [row('flatten', 0.35)];
  await trade(book, pet(0), fresh, true, Date.now(), price);
  check(Boolean(fresh[0].order) && (await held()) === 0, 'a flatten closes the exchange position completely', show(fresh));

  console.log(failed ? `\n${failed} FAILED` : '\nall checks passed — the exchange holds what the engine says, and every order is on the row');
  process.exit(failed ? 1 : 0);
}

main();
