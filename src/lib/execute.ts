import { contracts, demoCreds, fillsFor, place, position, setIsolated, setLeverage, setOneWay, MIN_NOTIONAL, type Contract, type Creds } from './exchange';
import { SPECIES, type Species } from './pets';
import { MANDATES } from './strategy';
import type { Entry, PetState } from './pet-math';

// Bitget's demo exchange executes what the engine decides.
//
// The engine still decides and still keeps the books. It is pure, the browser and the worker
// replay it identically, and Sharpe and drawdown come from its hourly marks. What changes is that
// for a pet trading on demo, every open, add, trim and close it writes is also sent to Bitget's
// demo environment as a market order, and the log row carries the order id and the price the
// exchange actually filled at. The gap between that fill and the bar close the engine booked is
// slippage — observed, where before it was simply left out.
//
// One demo account holds one isolated one-way position per symbol, so one pet per symbol can
// trade it: the first adopted. Only four of the six contracts exist in demo — OPENAIUSDT and
// RDDTUSDT do not — and those pets stay simulated and are labelled so.
//
// Nothing here throws into the tick. An order the exchange refuses becomes a `system` row saying
// why, and every tick ends by squaring the exchange position up with the engine's, so a missed
// order is corrected an hour later instead of drifting forever.

const TRADES = new Set<Entry['kind']>(['open', 'add', 'trim', 'flatten', 'liquidated']);

export type Book = { creds: Creds; contracts: Map<string, Contract> };

/** Null when no demo key is configured, or when the demo exchange cannot be reached at all. */
export async function openBook(): Promise<{ book: Book | null; note: string | null }> {
  const creds = demoCreds();
  if (!creds) return { book: null, note: null };
  try {
    const list = await contracts();
    // One-way is account-wide and was set when the gate ran; asking again while positions are
    // open is refused, which is fine — the mode it would set is the mode it already has.
    await setOneWay(creds).catch(() => {});
    return { book: { creds, contracts: new Map(list.map((k) => [k.symbol, k])) }, note: null };
  } catch (e) {
    return { book: null, note: `demo exchange unreachable, every pet stays simulated this tick — ${(e as Error).message}` };
  }
}

export const onDemo = (book: Book | null, species: Species['id']) =>
  Boolean(book && SPECIES[species] && book.contracts.has(SPECIES[species].symbol));

const step = (k: Contract) => Number(k.sizeMultiplier) || Math.pow(10, -Number(k.volumePlace || 0));
const snap = (qty: number, k: Contract) => Number((Math.floor(qty / step(k) + 1e-9) * step(k)).toFixed(Number(k.volumePlace || 4)));
const worthSending = (qty: number, price: number) => qty > 0 && qty * price >= MIN_NOTIONAL;

type Sent = { order: string; fill: number | null };

async function send(book: Book, symbol: string, side: 'buy' | 'sell', qty: number, reduceOnly: boolean): Promise<Sent> {
  const { orderId } = await place(book.creds, { symbol, side, size: qty, reduceOnly, clientOid: `kb-${side}-${Date.now()}` });
  // The fill lands a beat after the order is accepted.
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const f = await fillsFor(book.creds, symbol, orderId).catch(() => null);
    if (f && f.qty > 0) return { order: orderId, fill: f.price };
  }
  return { order: orderId, fill: null };
}

/**
 * Send this tick's trades to the demo exchange and square the position up afterwards.
 *
 * `fresh` is mutated in place: each trade row that reached the exchange gains its order id and
 * fill price, and `system` rows are appended for a refusal, a correction, or the cutover itself.
 * Returns true when this was the pet's first tick on the exchange.
 */
export async function trade(book: Book, pet: PetState, fresh: Entry[], alreadyLive: boolean, now: number, price: number): Promise<boolean> {
  const sp = SPECIES[pet.species];
  const k = book.contracts.get(sp.symbol)!;
  const mandate = MANDATES[pet.personality];
  let t = now; // system rows need distinct timestamps: (pet, ts, kind) is unique
  const note = (text: string, extra: Partial<Entry> = {}) => fresh.push({ ts: ++t, kind: 'system', text, paper: true, ...extra });

  try {
    await setIsolated(book.creds, sp.symbol).catch(() => {}); // refused once a position exists; it is already isolated
    await setLeverage(book.creds, sp.symbol, Math.min(mandate.maxLever, Number(k.maxLever) || mandate.maxLever));
  } catch (e) {
    note(`Could not set ${sp.symbol} to ${mandate.maxLever}× on the demo exchange — ${(e as Error).message}. Nothing sent this hour.`);
    return false;
  }

  // Before the cutover, this tick's trades happened in the simulation; the mirror below carries
  // their result onto the exchange in one order instead of replaying them one by one.
  if (alreadyLive) {
    for (const e of fresh) {
      if (!TRADES.has(e.kind) || !e.qty || !e.price) continue;
      const held = Number((await position(book.creds, sp.symbol).catch(() => null))?.total ?? 0);
      const buy = e.kind === 'open' || e.kind === 'add';
      const qty = buy ? snap(e.qty, k) : e.kind === 'trim' ? Math.min(snap(e.qty, k), held) : held;
      if (!worthSending(qty, e.price)) continue; // under the 5 USDT floor; the reconcile below catches it up
      try {
        const s = await send(book, sp.symbol, buy ? 'buy' : 'sell', qty, !buy);
        e.order = s.order;
        e.fill = s.fill ?? undefined;
        e.exec = 'demo';
      } catch (err) {
        note(`The demo exchange refused the ${e.kind} of ${qty} ${sp.symbol} — ${(err as Error).message}`);
      }
    }
  }

  // Square up: whatever the engine holds, the exchange should hold.
  const held = Number((await position(book.creds, sp.symbol).catch(() => null))?.total ?? 0);
  const want = snap(pet.position?.qty ?? 0, k);
  const gap = Number((want - held).toFixed(Number(k.volumePlace || 4)));
  if (price > 0 && worthSending(Math.abs(gap), price)) {
    try {
      const s = await send(book, sp.symbol, gap > 0 ? 'buy' : 'sell', Math.abs(gap), gap < 0);
      note(
        alreadyLive
          ? `The demo exchange held ${held} ${sp.symbol} and the book says ${want}. Squared it up: ${gap > 0 ? 'bought' : 'sold'} ${Math.abs(gap)}${s.fill ? ` at $${s.fill.toFixed(2)}` : ''}.`
          : `From here Bitget's demo exchange executes my trades. Mirrored the position I already held: ${gap > 0 ? 'bought' : 'sold'} ${Math.abs(gap)} ${sp.symbol}${s.fill ? ` at $${s.fill.toFixed(2)}` : ''}.`,
        { order: s.order, fill: s.fill ?? undefined, exec: 'demo', qty: Math.abs(gap), price },
      );
    } catch (err) {
      note(`Could not square the demo position up (exchange ${held}, book ${want}) — ${(err as Error).message}`);
      return false;
    }
  } else if (!alreadyLive) {
    note(`From here Bitget's demo exchange executes my trades.${want > 0 ? ` It already holds the ${want} ${sp.symbol} I do.` : ''}`, { exec: 'demo' });
  }
  return !alreadyLive;
}
