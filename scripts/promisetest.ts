import { runEngine } from '../src/lib/engine';
import { pinkyOf, type Judgement } from '../src/lib/brain';
import { promiseCard } from '../src/lib/proof';
import { OPEN_GUARD } from '../src/lib/risk';
import type { Entry, PetState, Personality } from '../src/lib/pet-math';
import type { PinkyAsk } from '../src/lib/strategy';
import type { Bar } from '../src/lib/bitget';

// Pinky promises on synthetic tapes: every way a promise can end, the Diamond exception, the
// liquidation floor, and the validator that decides what counts as a promise at all. Offline.

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `\n    ${detail}` : ''}`);
  if (!ok) failed++;
};

const H = 3600e3;
const SAT = Date.parse('2026-09-26T12:00:00Z'); // weekend: the fixed rules of a Boomer sit still
const WED = Date.parse('2026-09-23T16:00:00Z'); // 12:00 EDT, a normal session

/** One bar per close, each opening at the previous close. `lows` overrides a bar's low (a wick). */
function path(t0: number, closes: number[], lows: Record<number, number> = {}, highs: Record<number, number> = {}): Bar[] {
  let prev = closes[0];
  return closes.map((c, k) => {
    const b = { t: t0 + k * H, open: prev, high: highs[k] ?? Math.max(prev, c), low: lows[k] ?? Math.min(prev, c), close: c };
    prev = c;
    return b;
  });
}
const pet = (personality: Personality, at: number, margin = 50): PetState => ({
  species: 'nova', name: 'Testling', personality, adoptedAt: at - 30 * 24 * H, lastFed: at, streak: 1, lastVisitDay: '',
  margin, position: null, realized: 0, fundingPaid: 0, faints: 0, lastTickAt: at - H, marks: [], diary: [],
});
const opened = (at: number, pinky: PinkyAsk, lever = 1.5, usd = 30): Judgement => ({
  ts: at, intent: { kind: 'open', usd, lever, reason: 'Test open.', pinky }, rationale: 'Test open.', cited: [], confidence: 0.7, model: 'test',
});
const vows = (fresh: Entry[]) => fresh.filter((e) => e.kind === 'promise').map((e) => (e.meta as { outcome: string }).outcome);
const ASK: PinkyAsk = { thesis: 'Earnings lift it past resistance.', target: 105, stop: 97, hours: 48 };

// ── making one ─────────────────────────────────────────────────────────
console.log('\n═══ making a promise ═══\n');
const start = path(SAT, [100]);
const r0 = runEngine(pet('boomer', SAT), start, [], SAT, opened(SAT, ASK));
const p0 = r0.pet.position?.pinky;
check(Boolean(r0.pet.position) && vows(r0.fresh).join() === 'made', 'a model open with a promise opens and records it',
  r0.fresh.map((e) => `${e.kind}/${e.by}`).join(' → '));
check(p0?.target === 105 && p0?.stop === 97 && p0?.until === SAT + 48 * H && p0?.entry === 100, 'the promise rides on the position: target, stop, deadline, price made at');
check(/Pinky promise: Earnings lift it past resistance\. Target \$105\.00/.test(r0.fresh.find((e) => e.kind === 'promise')!.text), 'and says it in the diary, in plain words',
  r0.fresh.find((e) => e.kind === 'promise')!.text);
{
  const r = runEngine(pet('boomer', SAT), start, [], SAT, { ...opened(SAT, ASK), intent: { kind: 'open', usd: 30, lever: 1.5, reason: 'No promise.' } });
  const d = r.fresh.find((e) => e.kind === 'decided');
  check(Boolean(r.pet.position) && !r.pet.position?.pinky && (d?.meta as { promised?: boolean })?.promised === false, 'an open without one still opens, and the decision is marked unpromised');
}

// ── the four endings ───────────────────────────────────────────────────
console.log('\n═══ how it ends ═══\n');
{
  const t1 = SAT + H;
  const bars = [...start, ...path(t1, [99, 98.5, 99], { 1: 96.5 })];
  const r = runEngine(r0.pet, bars, [], t1 + 2 * H);
  const out = r.fresh.find((e) => e.kind === 'flatten');
  check(!r.pet.position && vows(r.fresh).join() === 'stopped' && out?.by === 'promise' && out.price === 97,
    'the stop is enforced: out at the stop, graded "stopped", by the promise', r.fresh.map((e) => `${e.kind}/${e.by} ${e.price ?? ''}`).join(' → '));
}
{
  const t1 = SAT + H;
  const gap = [...start, ...path(t1, [95])];
  gap[1] = { ...gap[1], open: 95.5, low: 95 };
  const r = runEngine(r0.pet, gap, [], t1);
  check(r.fresh.find((e) => e.kind === 'flatten')?.price === 95.5, 'a bar that gaps through the stop fills at its open, not at the stop');
}
{
  const t1 = SAT + H;
  const up = [...start, ...path(t1, [102, 104, 104.5], {}, { 2: 105.4 })];
  const r1 = runEngine(r0.pet, up, [], t1 + 2 * H);
  const pk = r1.pet.position?.pinky;
  check(vows(r1.fresh).join() === 'target' && pk?.hit === true && Math.abs((pk?.stop ?? 0) - r0.pet.position!.entry) < 1e-9,
    'the target is graded when touched, and the stop moves up to the entry', `stop now $${pk?.stop.toFixed(2)}`);
  const t2 = t1 + 3 * H;
  const back = [...up, ...path(t2, [101, 99.8])];
  const r2 = runEngine(r1.pet, back, [], t2 + H);
  check(!r2.pet.position && vows(r2.fresh).length === 0 && r2.fresh.find((e) => e.kind === 'flatten')?.by === 'promise',
    'giving it all back closes flat at the entry — and the promise is not graded twice');
}
{
  const t1 = SAT + H;
  const flat = [...start, ...path(t1, Array.from({ length: 50 }, (_, k) => 100 + (k % 2 ? 0.3 : -0.3)))];
  const r = runEngine(r0.pet, flat, [], t1 + 49 * H);
  check(vows(r.fresh).join() === 'expired' && Boolean(r.pet.position) && !r.pet.position?.pinky,
    'the deadline passes: graded "expired", the position stays, the promise is gone');
}
{
  const t1 = SAT + H;
  const r = runEngine(r0.pet, [...start, ...path(t1, [100.2])], [], t1, null, { ...OPEN_GUARD, halt: 'Owner pulled the plug.', noNewRisk: 'Owner pulled the plug.' });
  const v = r.fresh.find((e) => e.kind === 'promise');
  check(!r.pet.position && vows(r.fresh).join() === 'closed' && v?.by === 'kill', 'anything else that closes the position ends the promise as "closed", naming who closed it');
}

// ── the exceptions ─────────────────────────────────────────────────────
console.log('\n═══ exceptions ═══\n');
{
  const d0 = runEngine(pet('diamond', SAT), start, [], SAT, opened(SAT, ASK, 2));
  const t1 = SAT + H;
  const r = runEngine(d0.pet, [...start, ...path(t1, [96.5])], [], t1);
  check(vows(r.fresh).join() === 'stopped' && Boolean(r.pet.position) && !r.fresh.some((e) => e.kind === 'flatten'),
    'Diamond Hands is graded, never sold: "stopped", and still holding', r.fresh.find((e) => e.kind === 'promise')?.text);
}
{
  const bar = path(WED, [100]);
  const r = runEngine(pet('degen', WED), bar, [], WED, opened(WED, { ...ASK, stop: 60 }, 8, 25));
  const pk = r.pet.position?.pinky;
  check(Boolean(pk) && pk!.stop > 60 && /past my liquidation price/.test(r.fresh.find((e) => e.kind === 'promise')!.text),
    'a stop past the liquidation price is raised above it, and the diary says so', `asked $60, holds $${pk?.stop.toFixed(2)}`);
}
{
  const a = runEngine(pet('boomer', SAT), start, [], SAT, opened(SAT, ASK));
  check(JSON.stringify(a.fresh) === JSON.stringify(r0.fresh), 'the same inputs replay to the same promise, byte for byte');
}

{
  // Stopped out and promising again on the same bar: two promise rows in one hour must not share a key.
  const t1 = SAT + H;
  const bars = [...start, ...path(t1, [98], { 0: 96.5 })];
  const r = runEngine(r0.pet, bars, [], t1, opened(t1, { ...ASK, target: 104, stop: 94 }));
  const keys = r.fresh.map((e) => `${e.ts}|${e.kind}`);
  check(vows(r.fresh).join() === 'stopped,made' && new Set(keys).size === keys.length && Boolean(r.pet.position?.pinky),
    'a stop and a new promise in the same bar get distinct diary keys', r.fresh.map((e) => `${e.kind}@+${e.ts - t1}ms`).join(' '));
}

// ── the scorecard ──────────────────────────────────────────────────────
console.log('\n═══ the scorecard ═══\n');
{
  const rows = (fresh: Entry[]) => fresh.map((e) => ({ ts: e.ts, kind: e.kind, text: e.text, by: e.by, meta: e.meta }));
  const t1 = SAT + H;
  const stopped = runEngine(r0.pet, [...start, ...path(t1, [99, 98.5, 99], { 1: 96.5 })], [], t1 + 2 * H);
  const lost = promiseCard(rows([...r0.fresh, ...stopped.fresh]), t1 + 3 * H);
  check(lost.made === 1 && lost.stopped === 1 && lost.hitRate === 0 && Math.abs((lost.rewardRisk ?? 0) - 5 / 3) < 1e-9,
    'one promise, stopped: 0% right, and it had promised 1.67 of reward per unit of risk', JSON.stringify({ ...lost, recent: undefined }));
  const up = [...start, ...path(t1, [102, 104, 104.5], {}, { 2: 105.4 })];
  const hit = runEngine(r0.pet, up, [], t1 + 2 * H);
  const back = runEngine(hit.pet, [...up, ...path(t1 + 3 * H, [101, 99.8])], [], t1 + 4 * H);
  const won = promiseCard(rows([...r0.fresh, ...hit.fresh, ...back.fresh]), t1 + 5 * H);
  check(won.target === 1 && won.hitRate === 1 && won.recent[0].outcome === 'target' && won.recent[0].at === 105,
    'a target hit stays a win even after the break-even stop closes the position');
  const pending = promiseCard(rows(r0.fresh), SAT + H);
  check(pending.open === 1 && pending.hitRate === null, 'an unresolved promise is open, and there is no hit rate to claim yet');
}

// ── what the model's answer has to look like ───────────────────────────
console.log('\n═══ the validator ═══\n');
const ok = pinkyOf({ thesis: 'Up.', target_price: 110, stop_price: 95, horizon_hours: 24 }, 100);
check(ok?.target === 110 && ok.stop === 95 && ok.hours === 24, 'a well-formed promise passes through');
check(!pinkyOf({ thesis: 'Up.', target_price: 110, stop_price: 101, horizon_hours: 24 }, 100), 'a stop above the price is not a promise');
check(!pinkyOf({ thesis: 'Up.', target_price: 99, stop_price: 95, horizon_hours: 24 }, 100), 'a target below the price is not a promise');
check(!pinkyOf({ thesis: '', target_price: 110, stop_price: 95 }, 100), 'no thesis, no promise');
check(!pinkyOf({ thesis: 'Up.', target_price: 300, stop_price: 95 }, 100), 'a target three times the price is not a serious one');
check(pinkyOf({ thesis: 'Up.', target_price: 110, stop_price: 95, horizon_hours: 9999 }, 100)?.hours === 336 && pinkyOf({ thesis: 'Up.', target_price: 110, stop_price: 95 }, 100)?.hours === 72,
  'the horizon is clamped to two weeks, and defaults to three days');

console.log(failed ? `\n${failed} failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
