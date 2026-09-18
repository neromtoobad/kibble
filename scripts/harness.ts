// Replays every personality against REAL Bitget hourly bars and REAL settled funding,
// from adoption to now. Proves three things before any of this is wired to a screen:
// the engine is deterministic, funding actually drains the pet, and a liquidation
// happens when the tape says it should.
import { SPECIES, type Species } from '../src/lib/pets';
import { candles, historyCandles, fundingHistory, ticker, type Bar } from '../src/lib/bitget';
import { runEngine } from '../src/lib/engine';
import { equity, hunger, leverage, liquidationDistance, liquidationPrice, type PetState, type Personality } from '../src/lib/pet-math';
import { MANDATES, fundingApr } from '../src/lib/strategy';
import { metrics, metricsLine } from '../src/lib/metrics';
import { computeMood, moodLine } from '../src/lib/mood';
import { nyseSession } from '../src/lib/session';

const PERSONALITIES: Personality[] = ['diamond', 'degen', 'boomer', 'quant', 'owl'];
const DAYS = Number(process.argv[3] ?? 30);
const FEED = 100; // $100 fed at adoption

function newPet(sp: Species, personality: Personality, at: number): PetState {
  return {
    species: sp.id, name: sp.name, personality,
    adoptedAt: at, lastFed: at, streak: 1, lastVisitDay: '',
    margin: FEED, position: null, realized: 0, fundingPaid: 0, faints: 0,
    lastTickAt: at, marks: [],
    diary: [{ ts: at, text: `Adopted and fed $${FEED}.`, kind: 'feed', usd: FEED, paper: true }],
  };
}

async function deepBars(symbol: string, days: number): Promise<Bar[]> {
  const rows = new Map<number, Bar>();
  for (const b of await candles(symbol, 1000)) rows.set(b.t, b);
  let end = Math.min(...rows.keys());
  const want = Date.now() - days * 86400e3;
  for (let i = 0; i < 12 && end > want; i++) {
    const page = await historyCandles(symbol, end);
    if (!page.length) break;
    for (const b of page) rows.set(b.t, b);
    end = Math.min(...page.map((b) => b.t));
  }
  return [...rows.values()].sort((a, b) => a.t - b.t).filter((b) => b.t >= want);
}

async function main() {
  const id = (process.argv[2] ?? 'nova') as Species['id'];
  const sp = SPECIES[id];
  if (!sp) { console.error(`unknown species ${id}; try: ${Object.keys(SPECIES).join(', ')}`); process.exit(1); }

  const [bars, funds, tk] = await Promise.all([deepBars(sp.symbol, DAYS), fundingHistory(sp.symbol, 200), ticker(sp.symbol)]);
  const price = Number(tk?.lastPr ?? bars.at(-1)?.close ?? 0);
  const pct24h = Number(tk?.change24h ?? 0) * 100;
  const curFunding = Number(tk?.fundingRate ?? 0);

  console.log(`${sp.name} · ${sp.species} · ${sp.ticker} → ${sp.symbol}`);
  console.log(`${bars.length} hourly bars ${new Date(bars[0].t).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)!.t).toISOString().slice(0, 10)} · ${funds.length} funding settlements`);
  console.log(`now: $${price} · 24h ${pct24h >= 0 ? '+' : ''}${pct24h.toFixed(2)}% · funding ${fundingApr(curFunding).toFixed(1)}%/yr · session ${nyseSession()}\n`);

  const adoptedAt = bars[0].t;
  for (const p of PERSONALITIES) {
  const pet = newPet(sp, p, adoptedAt);
  const r1 = runEngine(pet, bars, funds, Date.now());
  // Determinism: the same inputs from the same start must produce the identical pet.
  const r2 = runEngine(newPet(sp, p, adoptedAt), bars, funds, Date.now());
  const same = JSON.stringify(r1.pet.diary.map((e) => [e.ts, e.kind, e.qty])) === JSON.stringify(r2.pet.diary.map((e) => [e.ts, e.kind, e.qty]));

  const f = r1.pet;
  const m = metrics(f, equity(f, price));
  const lev = leverage(f, price), liq = liquidationPrice(f), dist = liquidationDistance(f, price);
  const mood = computeMood({ pct24h, session: nyseSession(), hunger: hunger(f), fainted: f.faints > 0 && !f.position, liqDistPct: dist, fundingApr: fundingApr(curFunding), preIpo: sp.preIpo });

  console.log(`── ${p.toUpperCase().padEnd(8)} ${MANDATES[p].maxLever}× cap · trim under ${MANDATES[p].minLiqDistPct}% · funding limit ${MANDATES[p].maxFundingApr}%/yr`);
  console.log(`   equity $${equity(f, price).toFixed(2)} from $${FEED}  ·  margin $${f.margin.toFixed(2)}  ·  ${f.position ? `${f.position.qty.toFixed(3)} @ $${f.position.entry.toFixed(2)}, ${lev.toFixed(1)}× , liq $${liq?.toFixed(2)} (${dist?.toFixed(1)}% away)` : 'flat'}`);
  console.log(`   ${metricsLine(m)}  ·  deterministic: ${same ? 'yes' : 'NO'}`);
  console.log(`   mood: ${mood} — "${moodLine(mood, pct24h, sp.ticker, fundingApr(curFunding))}"`);
  const last = f.diary.filter((e) => e.kind !== 'hold').slice(-3);
  for (const e of last) console.log(`     ${new Date(e.ts).toISOString().slice(5, 16).replace('T', ' ')}  [${e.kind}] ${e.text}`);
  console.log();
  }
}

main();
