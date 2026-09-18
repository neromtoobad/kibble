// Liquidation is the one path the market may not hand us during a demo window, so it is
// tested directly: a synthetic tape that falls far enough to take out a leveraged long,
// with the wick — not the close — doing the damage.
import { runEngine } from '../src/lib/engine';
import { liquidationPrice, type PetState } from '../src/lib/pet-math';
import type { Bar } from '../src/lib/bitget';

const t0 = Date.parse('2026-09-01T00:00:00Z');
const hour = 3600e3;

const pet: PetState = {
  species: 'nova', name: 'Nova', personality: 'degen',
  adoptedAt: t0, lastFed: t0, streak: 1, lastVisitDay: '',
  margin: 100, position: { qty: 4, entry: 200, openedAt: t0 }, // $800 notional on $100 = 8×
  realized: 0, fundingPaid: 0, faints: 0, lastTickAt: t0, marks: [],
  diary: [{ ts: t0, text: 'seeded', kind: 'feed', usd: 100 }],
};

const liq = liquidationPrice(pet)!;
console.log(`8× long, 4 contracts @ $200, $100 margin → liquidation at $${liq.toFixed(2)}`);
console.log(`expected ≈ (4·200 − 100) / (4·0.995) = $${((4 * 200 - 100) / (4 * 0.995)).toFixed(2)}\n`);

// A bar whose CLOSE is above the liquidation price but whose LOW dips through it.
const bars: Bar[] = [
  { t: t0 + hour, open: 200, high: 201, low: 199, close: 200 },
  { t: t0 + 2 * hour, open: 200, high: 200, low: liq - 0.5, close: liq + 3 },
  { t: t0 + 3 * hour, open: liq + 3, high: liq + 4, low: liq + 2, close: liq + 3 },
];

const r = runEngine(pet, bars, [{ t: t0, rate: 0.0001 }], t0 + 4 * hour);
const faint = r.fresh.find((e) => e.kind === 'liquidated');
console.log(faint ? `✓ fainted: ${faint.text}` : '✗ NO LIQUIDATION — the wick was ignored');
console.log(`  position after: ${r.pet.position ? 'still open (WRONG)' : 'flat'} · faints ${r.pet.faints} · margin $${r.pet.margin.toFixed(2)}`);

// And the control: the same fall, but the wick stops just short.
const safe: Bar[] = [{ t: t0 + hour, open: 200, high: 201, low: liq + 0.5, close: liq + 2 }];
const r2 = runEngine(pet, safe, [{ t: t0, rate: 0.0001 }], t0 + 2 * hour);
console.log(r2.fresh.some((e) => e.kind === 'liquidated') ? '✗ liquidated when it should NOT have' : '✓ survives a wick that stops short');
