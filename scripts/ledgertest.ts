import { guardianLedger, HORIZON_H, type LedgerRow } from '../src/lib/proof';
import { TAKER_FEE } from '../src/lib/pet-math';
import type { Bar } from '../src/lib/bitget';

// The guardian's ledger on a synthetic tape: a refused buy is one missed trade however often it is
// refused, a trade or 24 hours starts a new one, and cuts always count. Offline.

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `\n    ${detail}` : ''}`);
  if (!ok) failed++;
};

const H = 3600e3;
const T0 = Date.parse('2026-10-01T00:00:00Z');
// A steady climb, $1 an hour from $100, for four days: every refused buy would have made money.
const bars: Bar[] = Array.from({ length: 96 }, (_, k) => ({ t: T0 + k * H, open: 100 + k - 1, high: 100 + k, low: 100 + k - 1, close: 100 + k }));
const refused = (h: number, by = 'storm', qty = 1): LedgerRow => ({
  ts: T0 + h * H, kind: 'vetoed', by, text: 'Wanted to add, refused.', meta: { shadow: { qty, price: 100 + h } },
});
const moved = (h: number, kind: 'add' | 'trim', by = 'model'): LedgerRow => ({ ts: T0 + h * H, kind, by, text: `${kind}.`, qty: 0.5, price: 100 + h });
/** What one refused buy of `qty` at hour h is worth to the ledger: the 24-hour move, less round-trip fees. */
const worth = (h: number, qty = 1) => -(qty * HORIZON_H - 2 * qty * (100 + h) * TAKER_FEE);

{
  const g = guardianLedger([0, 1, 2, 3, 4, 5].map((h) => refused(h)), bars);
  check(g.count === 1 && g.repeats === 5, 'six hourly refusals of the same buy are one missed trade', `count ${g.count}, repeats ${g.repeats}`);
  check(Math.abs(g.saved - worth(0)) < 1e-9, 'it is priced from the first refusal', `saved ${g.saved.toFixed(4)} vs ${worth(0).toFixed(4)}`);
}
{
  const g = guardianLedger([refused(0), refused(1, 'kennel'), refused(2, 'storm')], bars);
  check(g.count === 1, 'a different layer refusing the same buy is still the same missed trade', `count ${g.count}`);
}
{
  const g = guardianLedger([refused(0), refused(1), moved(2, 'add'), refused(3), refused(4)], bars);
  check(g.count === 2 && g.repeats === 2, 'a trade in between starts a new run', `count ${g.count}, repeats ${g.repeats}`);
}
{
  const g = guardianLedger([refused(0), refused(10), refused(23), refused(24), refused(30)], bars);
  check(g.count === 2 && g.interventions[1].ts === T0 + 24 * H, 'after 24 hours a refusal counts again', `count ${g.count}, second at h${(g.interventions[1]?.ts - T0) / H}`);
}
{
  const cut = (h: number): LedgerRow => ({ ts: T0 + h * H, kind: 'trim', by: 'kennel', text: 'Cut to 1x.', qty: 0.5, price: 100 + h });
  const g = guardianLedger([cut(0), cut(1), cut(2)], bars);
  check(g.count === 3 && g.repeats === 0, 'cuts are real trades, so every one counts', `count ${g.count}`);
}
{
  const g = guardianLedger([refused(0), refused(1), { ts: T0 + 2 * H, kind: 'liquidated', text: 'Fainted.' }, refused(3)], bars);
  check(g.count === 2, 'a liquidation ends the run too', `count ${g.count}`);
}
{
  // A refusal the ledger cannot score (from before shadows were recorded) neither counts nor starts a run.
  const bare: LedgerRow = { ts: T0, kind: 'vetoed', by: 'storm', text: 'Asked for $40, allowed $10.' };
  const g = guardianLedger([bare, refused(1)], bars);
  check(g.count === 1 && g.repeats === 0 && g.interventions[0].ts === T0 + H, 'an unscorable refusal does not open a run');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
