import { gate, MANDATES, fundingApr, type Intent, type StrategyState } from '../src/lib/strategy';
import { runEngine } from '../src/lib/engine';
import type { Judgement } from '../src/lib/brain';
import type { Bar } from '../src/lib/bitget';
import type { PetState } from '../src/lib/pet-math';

// The model decides; the mandate decides what the model is allowed to have done. This proves
// the second half, which is the part that has to hold when the first half is wrong, confused,
// or talked into something. None of it needs an API key: the model's decision is an input to
// the engine, so a bad decision can simply be handed in.

let failures = 0;
const check = (name: string, cond: boolean, detail: string) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  console.log(`    ${detail}`);
  if (!cond) failures++;
};

const state = (over: Partial<StrategyState> = {}): StrategyState => ({
  margin: 100, qty: 0, entry: 0, price: 200, lever: 0,
  liqDistPct: null, fundingRate: 0, lastActionAt: 0, totalFed: 100, ...over,
});

console.log('\n═══ the mandate against a model that wants more ═══\n');

// 1. Leverage it is not allowed to have.
{
  const m = MANDATES.boomer; // 1.5× ceiling
  const asked: Intent = { kind: 'open', usd: 100, lever: 20, reason: 'ALL IN on the earnings beat' };
  const g = gate(m, state(), asked, 100);
  const got = g.intent.kind === 'open' ? g.intent.lever : -1;
  check('leverage is clamped to the mandate, not the exchange ceiling',
    got === 1.5,
    `model asked for 20× on a contract that allows 100×; mandate allows 1.5× → got ${got}×`);
}

// 2. Size beyond the reserve.
{
  const m = MANDATES.boomer; // keeps 30% back
  const asked: Intent = { kind: 'open', usd: 100, lever: 1.5, reason: 'deploy everything' };
  const g = gate(m, state(), asked, 100);
  const usd = g.intent.kind === 'open' ? g.intent.usd : -1;
  check('the reserve is not spendable even on request',
    usd === 70 && g.clamped !== null,
    `model asked for $100 of $100 margin; 30% reserve → allowed $${usd}. ${g.clamped}`);
}

// 3. A carry the mandate refuses.
{
  const m = MANDATES.quant; // refuses over 15%/yr
  const rate = 0.0015; // ≈ 164%/yr
  const asked: Intent = { kind: 'add', usd: 50, reason: 'the news is good, size up' };
  const g = gate(m, state({ fundingRate: rate }), asked, 100);
  check('buying into a carry above the limit is refused outright',
    g.intent.kind === 'hold' && g.veto !== null,
    `funding ${fundingApr(rate).toFixed(0)}%/yr vs a ${m.maxFundingApr}% limit → ${g.intent.kind}. ${g.veto}`);
}

// 4. Standing risk beats judgement.
{
  const m = MANDATES.degen; // trims under 12%
  const asked: Intent = { kind: 'add', usd: 40, reason: 'buy the dip, it always comes back' };
  const g = gate(m, state({ qty: 2, entry: 200, liqDistPct: 4, lever: 8 }), asked, 100);
  check('a position near liquidation is trimmed however bullish the model is',
    g.intent.kind === 'trim' && g.veto !== null,
    `model said "add"; liquidation 4% away vs a ${m.minLiqDistPct}% floor → ${g.intent.kind}. ${g.veto}`);
}

// 5. A legal decision is left alone.
{
  const m = MANDATES.diamond;
  const asked: Intent = { kind: 'open', usd: 50, lever: 2, reason: 'measured entry' };
  const g = gate(m, state(), asked, 100);
  check('a decision inside the mandate passes through untouched',
    g.intent.kind === 'open' && g.veto === null && g.clamped === null && g.intent.usd === 50,
    `$50 at 2× under a 2× mandate → passed as asked`);
}

console.log('\n═══ event → decision → execution, end to end ═══\n');

// A flat tape, so anything that happens is the decision and not the price.
const t0 = Date.UTC(2026, 8, 17, 0, 0, 0);
const bars: Bar[] = Array.from({ length: 6 }, (_, i) => ({
  t: t0 + i * 3600e3, open: 200, high: 200.5, low: 199.5, close: 200, volume: 1000,
}));

const pet: PetState = {
  species: 'nova', name: 'Nova', personality: 'boomer',
  adoptedAt: t0, lastFed: t0, streak: 1, lastVisitDay: '',
  margin: 100, position: null, realized: 0, fundingPaid: 0, faints: 0,
  marks: [], lastTickAt: t0, diary: [], proposal: null,
};

const judgement: Judgement = {
  ts: bars.at(-1)!.t,
  intent: { kind: 'open', usd: 100, lever: 50, reason: 'Guidance was raised and the shares cannot react until Monday. Opening.' },
  rationale: 'Guidance was raised and the shares cannot react until Monday. Opening.',
  cited: ['8-K item 2.02 — results of operations (earnings release)'],
  confidence: 0.72,
  model: 'test-harness',
};

const res = runEngine(pet, bars, [], bars.at(-1)!.t, judgement);
for (const e of res.fresh) console.log(`   [${e.kind}] ${e.text}`);

const kinds = res.fresh.map((e) => e.kind);
const opened = res.fresh.find((e) => e.kind === 'open');
console.log();
check('the decision is recorded before the execution',
  kinds.indexOf('decided') >= 0 && kinds.indexOf('decided') < kinds.indexOf('open'),
  `diary order: ${kinds.join(' → ')}`);
check('the override is recorded too, not silently applied',
  kinds.includes('vetoed'),
  'a clamp the owner cannot see is a clamp the owner cannot audit');
check('what executed obeys the mandate, not the model',
  !!opened && Math.abs((opened.usd ?? 0) - 70) < 0.01,
  `model asked for $100 at 50×; executed $${opened?.usd?.toFixed(2)} at 1.5× (Boomer keeps 30% back)`);

console.log(failures ? `\n${failures} check(s) failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
