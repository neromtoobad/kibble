import { existsSync } from 'node:fs';
import { FAMILIES, FAMILY_LIST, MOODS, SPECIES, SPECIES_LIST, bySymbol, eggImage, petImage } from '../src/lib/pets';

// The adoptable universe against the art and the rules it was built by. Pure and offline: it reads
// the checked-in snapshot and public/, never the exchange.

let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failed++;
};
const file = (url: string) => existsSync(`public${url}`);

const founders = SPECIES_LIST.filter((s) => s.founder);
check(founders.length === 6 && founders.every((s) => s.id === s.family), 'six founders, each keyed by its own family');
check(SPECIES_LIST.length > 80, `a real universe: ${SPECIES_LIST.length} adoptable perpetuals`);
check(new Set(SPECIES_LIST.map((s) => s.ticker)).size === SPECIES_LIST.length, 'no ticker listed twice (founders are not repeated in the universe)');
check(SPECIES_LIST.every((s) => bySymbol(s.symbol)?.id === s.id), 'every symbol resolves back to its own species');
check(SPECIES_LIST.every((s) => s.symbol === `${s.ticker}USDT`), 'every symbol is the ticker on the USDT book');
check(SPECIES_LIST.every((s) => s.maxLever >= 1 && s.maxLever <= 150), 'leverage ceilings are sane');

const missing = FAMILY_LIST.flatMap((f) =>
  [...MOODS, 'hero' as const].map((m) => `/pets/${f.id}/${m}.png`).concat(`/pets/eggs/${f.id}.png`).filter((u) => !file(u)));
check(!missing.length, `every family has a hero, ${MOODS.length} moods and an egg${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);
check(SPECIES_LIST.every((s) => file(petImage(s.id, 'happy')) && file(eggImage(s.id))), 'every species draws as its family');
check(FAMILY_LIST.every((f) => SPECIES_LIST.some((s) => s.family === f.id)), 'no empty family');

const founderNames = new Set(founders.map((s) => s.name));
check(SPECIES_LIST.filter((s) => !s.founder).every((s) => !founderNames.has(s.name) && FAMILIES[s.family].names.includes(s.name)),
  "non-founders get a family name, never a founder's");
check(SPECIES.AMD?.family === 'nova' && SPECIES.COIN?.family === 'hodl' && SPECIES.SPY?.family === 'basket', 'AMD is a robot cat, COIN a hamster, SPY a tortoise');
check(['TQQQ', 'SQQQ', 'SOXL', 'NVDL', 'UVXY', 'MSTU'].every((t) => !SPECIES[t]), 'no leveraged, inverse or volatility ETFs');
check(['XAU', 'USDJPY', 'SAMSUNG', 'HSI'].every((t) => !SPECIES[t]), 'no metals, FX or non-US listings');
check(SPECIES_LIST.filter((s) => s.preIpo).every((s) => s.kind === 'private'), 'only private companies are pre-IPO');

console.log(failed ? `\n${failed} failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
