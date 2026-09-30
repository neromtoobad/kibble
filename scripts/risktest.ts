import { runEngine } from '../src/lib/engine';
import { KENNEL, OPEN_GUARD, SLEEP_CAP, kennelGuard, realizedVol, sleepWindow, stormCap, type Guard } from '../src/lib/risk';
import { MANDATES } from '../src/lib/strategy';
import { leverage, type PetState, type Personality } from '../src/lib/pet-math';
import type { Bar } from '../src/lib/bitget';

// The risk layer that looks past one decision — storm sense, the weekend guard and the kennel
// breaker — checked on synthetic tapes, so it runs anywhere with no network and no key.

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `\n    ${detail}` : ''}`);
  if (!ok) failed++;
};

const H = 3600e3;
/** Hourly bars ending at `end`, walking from 100 with a repeating step pattern. */
function tape(end: number, hours: number, step: (k: number) => number): Bar[] {
  const out: Bar[] = [];
  let p = 100;
  for (let k = hours - 1; k >= 0; k--) {
    const t = end - k * H;
    const next = p * (1 + step(k));
    out.push({ t, open: p, high: Math.max(p, next) * 1.001, low: Math.min(p, next) * 0.999, close: next });
    p = next;
  }
  return out;
}
const pet = (personality: Personality, qty: number, entry: number, at: number, margin = 50): PetState => ({
  species: 'nova', name: 'Testling', personality, adoptedAt: at - 30 * 24 * H, lastFed: at, streak: 1, lastVisitDay: '',
  margin, position: qty > 0 ? { qty, entry, openedAt: at - 20 * 24 * H } : null,
  realized: 0, fundingPaid: 0, faints: 0, lastTickAt: at - H, marks: [], diary: [],
});

const SAT_NOON = Date.parse('2026-09-26T12:00:00Z');   // NYSE closed for the weekend
const FRI_1530_ET = Date.parse('2026-09-25T19:30:00Z'); // 15:30 EDT, half an hour before the bell
const WED_NOON_ET = Date.parse('2026-09-23T16:00:00Z'); // 12:00 EDT, a normal session

// ── storm sense ────────────────────────────────────────────────────────
console.log('\n═══ storm sense ═══\n');
const calm = tape(SAT_NOON, 72, (k) => (k % 2 ? 0.0005 : -0.0004));
const storm = tape(SAT_NOON, 72, (k) => (k % 2 ? 0.03 : -0.028));
const vCalm = realizedVol(calm, calm.length - 1), vStorm = realizedVol(storm, storm.length - 1);
const owlB = MANDATES.owl.volBudget;
check(Math.abs((stormCap(owlB, 0.3) ?? 0) - MANDATES.owl.maxLever) < 1e-9, 'at 30% volatility a mandate gets exactly its declared leverage',
  `owl budget ${Math.round(owlB * 100)}% ÷ 30% = ${stormCap(owlB, 0.3)?.toFixed(1)}×`);
check((stormCap(owlB, vCalm) ?? 0) > MANDATES.owl.maxLever && (stormCap(owlB, vStorm) ?? 99) < 1, 'calm water leaves room; a storm cuts it',
  `calm ${Math.round((vCalm ?? 0) * 100)}% vol → ${stormCap(owlB, vCalm)?.toFixed(1)}× allowed · storm ${Math.round((vStorm ?? 0) * 100)}% → ${stormCap(owlB, vStorm)?.toFixed(2)}×`);
{
  const r1 = runEngine(pet('owl', 0, 0, SAT_NOON), calm, [], SAT_NOON);
  const r2 = runEngine(pet('owl', 0, 0, SAT_NOON), storm, [], SAT_NOON);
  const o1 = r1.fresh.find((e) => e.kind === 'open'), o2 = r2.fresh.find((e) => e.kind === 'open');
  const n = (o?: { qty?: number; price?: number }) => (o?.qty ?? 0) * (o?.price ?? 0);
  check(Boolean(o1) && n(o2) < n(o1) && (!o2 || /storm sense/.test(o2.text)), 'the same pet opens smaller in a storm, and says why',
    `calm: $${n(o1).toFixed(2)} notional · storm: $${n(o2).toFixed(2)}${o2 ? ` — "${o2.text}"` : ' (nothing fit the budget)'}`);
}
{
  // Midweek, so the weekend guard (which runs first) is not the one doing the cutting.
  const wstorm = tape(WED_NOON_ET, 72, (k) => (k % 2 ? 0.03 : -0.028));
  const price = wstorm.at(-1)!.close;
  const r = runEngine(pet('owl', (50 * 4) / price, price, WED_NOON_ET), wstorm, [], WED_NOON_ET);
  const trim = r.fresh.find((e) => e.kind === 'trim' && /Storm sense/.test(e.text));
  check(Boolean(trim), 'a 4× owl caught in a storm is cut back to its budget', `"${trim?.text}"`);
  const d = runEngine(pet('diamond', (50 * 2) / price, price, WED_NOON_ET), wstorm, [], WED_NOON_ET);
  check(!d.fresh.some((e) => e.kind === 'trim' && /Storm sense/.test(e.text)), 'Diamond Hands is not cut for volatility — it never trims for price');
}

// ── weekend guard ──────────────────────────────────────────────────────
console.log('\n═══ weekend guard ═══\n');
check(sleepWindow(FRI_1530_ET) && sleepWindow(SAT_NOON) && !sleepWindow(WED_NOON_ET), 'the sleep window is Friday 15:00 ET to Monday\'s open', 'Fri 15:30 ET yes · Sat yes · Wed noon no');
{
  const bars = tape(FRI_1530_ET, 48, (k) => (k % 2 ? 0.001 : -0.0009));
  const price = bars.at(-1)!.close;
  const p = pet('owl', (50 * 4) / price, price, FRI_1530_ET);
  const before = leverage(p, price);
  const r = runEngine(p, bars, [], FRI_1530_ET);
  const after = leverage(r.pet, price);
  const trim = r.fresh.find((e) => e.kind === 'trim');
  check(before > 3.9 && after <= SLEEP_CAP * 1.03 && Boolean(trim && /Weekend guard/.test(trim.text) && /16:00 ET/.test(trim.text)),
    `a 4× owl is cut to ${SLEEP_CAP}× half an hour before Friday's close`, `${before.toFixed(2)}× → ${after.toFixed(2)}× — "${trim?.text}"`);
}
{
  // Saturday: the share shut at Friday's close and the perp has drifted up since — the pet should
  // cut to the cap and quote that drift as the gap waiting at Monday's bell.
  const bars = tape(SAT_NOON, 48, (k) => (k < 20 ? 0.002 : 0.0001));
  const price = bars.at(-1)!.close;
  const p = pet('owl', (50 * 4) / price, price, SAT_NOON);
  const r = runEngine(p, bars, [], SAT_NOON);
  const trim = r.fresh.find((e) => e.kind === 'trim');
  const quoted = trim?.text.match(/perp is (-?[\d.]+)%/)?.[1];
  check(Boolean(trim && quoted && Number(quoted) > 0), 'on Saturday it cuts to the cap and quotes the Monday gap', `"${trim?.text}"`);
}
{
  const bars = tape(WED_NOON_ET, 48, (k) => (k % 2 ? 0.001 : -0.0009));
  const price = bars.at(-1)!.close;
  const p = pet('owl', (50 * 4) / price, price, WED_NOON_ET);
  const r = runEngine(p, bars, [], WED_NOON_ET);
  check(!r.fresh.some((e) => /Weekend guard/.test(e.text)), 'midweek, the same position is left alone');
}

// ── kennel breaker ─────────────────────────────────────────────────────
console.log('\n═══ kennel breaker ═══\n');
const day0 = Date.parse('2026-09-26T00:00:00Z');
{
  const marks: Array<Array<[number, number]>> = [
    [[day0 - H, 50], [day0, 50], [SAT_NOON, 48]],
    [[day0 - H, 50], [day0, 50], [SAT_NOON, 48]],
  ];
  const { guard, status } = kennelGuard(marks, 100, SAT_NOON, null, 0);
  check(status.breaker === 'daily-loss' && Boolean(guard.noNewRisk), 'down 4% on the day trips the 3% daily limit', status.reason ?? '');
  const bars = tape(SAT_NOON, 48, (k) => (k % 2 ? 0.0005 : -0.0004));
  const r = runEngine(pet('owl', 0, 0, SAT_NOON), bars, [], SAT_NOON, null, guard);
  check(!r.fresh.some((e) => e.kind === 'open') && r.fresh.some((e) => e.kind === 'vetoed' && /daily limit/.test(e.text)),
    'a pet that wants to open is refused, and the refusal is written down', r.fresh.find((e) => e.kind === 'vetoed')?.text ?? '');
}
{
  // Hourly marks ending at `now`: the breaker trips at 8% under the high-water mark, holds while
  // still more than 5% under it, and releases on recovery or after 24 hours — whichever is first.
  const at = (eqs: number[], now = SAT_NOON) => kennelGuard([eqs.map((e, k) => [now - (eqs.length - 1 - k) * H, e] as [number, number])], 0, now, null, 0).status.breaker;
  const seq = [at([100, 91]), at([100, 91, 94]), at([100, 91, 94, 96])];
  // At 96 the drawdown breaker has released; on the same day the 3% daily-loss limit is what holds.
  check(seq[0] === 'drawdown' && seq[1] === 'drawdown' && seq[2] !== 'drawdown', `the drawdown breaker trips at ${KENNEL.drawdownPct}% and holds until back within ${KENNEL.resumePct}%`,
    `100 → 91: ${seq[0]} · → 94: ${seq[1]} · → 96: ${seq[2]}`);
  const stuck = [100, 91, ...Array(30).fill(91)];
  check(at(stuck.slice(0, 20)) === 'drawdown' && at(stuck) === 'armed', `but not for longer than ${KENNEL.cooldownHours} hours — it re-arms from where it stands`,
    `still 9% under after 18h: ${at(stuck.slice(0, 20))} · after 30h: ${at(stuck)}`);
  const before = kennelGuard([[[SAT_NOON - 48 * H, 200], [SAT_NOON - H, 150], [SAT_NOON, 150]]], 0, SAT_NOON, null, SAT_NOON - 2 * H).status.breaker;
  check(before === 'armed', 'equity from before the breaker went live does not count against it', `a 25% fall two days before the epoch → ${before}`);
}
{
  const bars = tape(WED_NOON_ET, 48, (k) => (k % 2 ? 0.001 : -0.0009));
  const price = bars.at(-1)!.close;
  const guard: Guard = { ...OPEN_GUARD, halt: 'Kill switch: pulled by the owner.', noNewRisk: 'Kill switch: pulled by the owner.' };
  const r = runEngine(pet('diamond', 1, price, WED_NOON_ET), bars, [], WED_NOON_ET, null, guard);
  check(!r.pet.position && r.fresh.some((e) => e.kind === 'flatten' && /Kill switch/.test(e.text)), 'the kill switch flattens the pet on its next bar', r.fresh.find((e) => e.kind === 'flatten')?.text ?? '');
}
{
  const bars = tape(WED_NOON_ET, 48, (k) => (k % 2 ? 0.001 : -0.0009));
  const price = bars.at(-1)!.close;
  const guard: Guard = { ...OPEN_GUARD, deleverTo: 1, noNewRisk: 'The kennel is 9.0% below its peak.' };
  const p = pet('quant', (50 * 3) / price, price, WED_NOON_ET);
  const r = runEngine(p, bars, [], WED_NOON_ET, null, guard);
  check(leverage(r.pet, price) <= 1.03, 'the drawdown breaker cuts a 3× pet to 1×', `${leverage(p, price).toFixed(2)}× → ${leverage(r.pet, price).toFixed(2)}×`);
}
{
  const bars = tape(SAT_NOON, 48, (k) => (k % 2 ? 0.0005 : -0.0004));
  const roomy = runEngine(pet('owl', 0, 0, SAT_NOON), bars, [], SAT_NOON, null, { ...OPEN_GUARD, exposureRoom: 1000 });
  const tight = runEngine(pet('owl', 0, 0, SAT_NOON), bars, [], SAT_NOON, null, { ...OPEN_GUARD, exposureRoom: 30 });
  const full = runEngine(pet('owl', 0, 0, SAT_NOON), bars, [], SAT_NOON, null, { ...OPEN_GUARD, exposureRoom: 0 });
  const n = (r: typeof roomy) => { const o = r.fresh.find((e) => e.kind === 'open'); return o ? (o.qty ?? 0) * (o.price ?? 0) : 0; };
  check(n(tight) <= 30.01 && n(tight) < n(roomy) && n(full) === 0 && full.fresh.some((e) => /exposure cap/.test(e.text)),
    'the kennel exposure cap clamps a buy, and blocks it when the room is gone',
    `room $1000 → $${n(roomy).toFixed(2)} notional · room $30 → $${n(tight).toFixed(2)} · room $0 → nothing, "${full.fresh.find((e) => /exposure cap/.test(e.text))?.text}"`);
}

// ── determinism ────────────────────────────────────────────────────────
console.log('\n═══ determinism ═══\n');
{
  // Three days ending Saturday noon: a volatile tape across Friday's close, so the replay has to
  // walk the storm sizing, the weekend trim and the exposure cap to get the same answer twice.
  const bars = tape(SAT_NOON, 72, (k) => (k % 3 ? 0.02 : -0.025));
  const guard: Guard = { ...OPEN_GUARD, exposureRoom: 120 };
  const start = (): PetState => ({ ...pet('owl', 1.6, 100, SAT_NOON), lastTickAt: SAT_NOON - 71 * H });
  const a = runEngine(start(), bars, [], SAT_NOON, null, guard);
  const b = runEngine(start(), bars, [], SAT_NOON, null, guard);
  check(a.fresh.length > 0, 'the replay actually does something', a.fresh.map((e) => e.kind).join(' · '));
  check(JSON.stringify(a.fresh) === JSON.stringify(b.fresh), 'the same tape and the same guard write the same diary', `${a.fresh.length} entries, identical`);
}

console.log(failed ? `\n${failed} FAILED\n` : '\nall checks passed\n');
process.exit(failed ? 1 : 0);
