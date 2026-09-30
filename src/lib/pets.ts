import universe from '@/data/universe.json';

// Species registry — the home stock decides the species. Every one of these trades on
// Bitget as a tokenized-stock perpetual (rToken), verified live against the contracts
// endpoint: the symbol, the exchange's own leverage ceiling, and the 8-hour funding
// clock are pulled from there, not invented here.
//
// `maxLever` is the exchange's cap for that contract and doubles as a species trait —
// a robot cat can take more risk than a cloud. The strategies cap themselves well below it.
//
// Two layers. A family is an animal and the kind of business it stands for: its art, its one
// deliberate wrong detail. A species entry is one adoptable stock. The six founders came first and
// keep their own keys ('nova', 'volt' …) and names; every other liquid stock perpetual comes from
// src/data/universe.json (scripts/build-universe.mjs), keyed by its ticker and drawn as the animal
// of its sector — AMD hatches a robot cat, Coinbase a hamster. Keys never collide: founders are
// lowercase, tickers uppercase.

export const MOODS = [
  'ecstatic', 'happy', 'chill', 'nervous', 'sulking', 'nightowl', 'pajamas', 'hungry', 'fainted',
] as const;
export type Mood = (typeof MOODS)[number];

export type Family =
  | 'nova' | 'pip' | 'nimbus' | 'lurk' | 'volt' | 'booster'
  | 'hodl' | 'ledger' | 'dose' | 'crude' | 'tote' | 'rivet' | 'basket';

export type FamilyInfo = {
  id: Family;
  species: string;      // what it is
  sector: string;       // what it stands for
  wrongDetail: string;  // the one deliberate flaw, same on every pet of the family
  names: string[];      // default names for pets that aren't the founder; the owner renames at adoption
};

export const FAMILIES: Record<Family, FamilyInfo> = {
  nova: { id: 'nova', species: 'Robot cat', sector: 'Chips & hardware', wrongDetail: 'left ear bent', names: ['Chip', 'Servo', 'Pixel', 'Ohm', 'Diode', 'Byte'] },
  pip: { id: 'pip', species: 'Earbud hedgehog', sector: 'Computers & gadgets', wrongDetail: 'one bent spine', names: ['Bud', 'Click', 'Nib', 'Dot', 'Ping', 'Jack'] },
  nimbus: { id: 'nimbus', species: 'Cloud', sector: 'Software, cloud & AI', wrongDetail: 'drooping puff', names: ['Puff', 'Cirrus', 'Mist', 'Wisp', 'Stratus', 'Fog'] },
  lurk: { id: 'lurk', species: 'Night owl', sector: 'Internet & media', wrongDetail: 'one eye half closed', names: ['Hoot', 'Scroll', 'Echo', 'Feed', 'Thread', 'Meme'] },
  volt: { id: 'volt', species: 'Lightning dog', sector: 'EVs, power & batteries', wrongDetail: 'right ear folded', names: ['Amp', 'Sparky', 'Watt', 'Zap', 'Surge', 'Ion'] },
  booster: { id: 'booster', species: 'Space frog', sector: 'Aerospace & space', wrongDetail: 'mismatched eyes, crooked patch', names: ['Orbit', 'Comet', 'Hop', 'Apollo', 'Rocket', 'Lander'] },
  hodl: { id: 'hodl', species: 'Hamster', sector: 'Crypto', wrongDetail: 'one cheek stuffed with a coin', names: ['Hodl', 'Satoshi', 'Nibbles', 'Stack', 'Sats', 'Moon'] },
  ledger: { id: 'ledger', species: 'Banker penguin', sector: 'Banks, brokers & payments', wrongDetail: 'monocle on crooked', names: ['Ledger', 'Penny', 'Monty', 'Sterling', 'Tux', 'Dime'] },
  dose: { id: 'dose', species: 'Capsule bunny', sector: 'Health & biotech', wrongDetail: 'one bandaged ear', names: ['Dose', 'Pill', 'Clover', 'Tonic', 'Remy', 'Mint'] },
  crude: { id: 'crude', species: 'Rhino beetle', sector: 'Oil, gas & mining', wrongDetail: 'chipped horn', names: ['Crude', 'Barrel', 'Rig', 'Flint', 'Drill', 'Ore'] },
  tote: { id: 'tote', species: 'Kangaroo', sector: 'Shops & brands', wrongDetail: 'one parcel upside down', names: ['Tote', 'Parcel', 'Bargain', 'Cart', 'Roo', 'Tag'] },
  rivet: { id: 'rivet', species: 'Armadillo', sector: 'Industrials', wrongDetail: 'one shell plate out of line', names: ['Rivet', 'Bolt', 'Girder', 'Torque', 'Axel', 'Weld'] },
  basket: { id: 'basket', species: 'Mosaic tortoise', sector: 'Index funds', wrongDetail: 'one mosaic tile missing', names: ['Basket', 'Tessa', 'Mosaic', 'Bento', 'Patch', 'Spread'] },
};
export const FAMILY_LIST = Object.values(FAMILIES);

export type Kind = 'stock' | 'etf' | 'index' | 'private';

export type Species = {
  id: string;           // founders: 'nova' …; everyone else: the ticker
  family: Family;
  founder: boolean;
  name: string;         // default pet name
  species: string;      // what it is
  ticker: string;       // home stock
  company: string;      // who it is, for the news search and the page
  symbol: string;       // Bitget perpetual
  kind: Kind;
  maxLever: number;     // the exchange's ceiling for this contract
  wrongDetail: string;  // the one deliberate flaw
  preIpo: boolean;      // no public share behind it — the perp is the only market there is
  volume24h: number | null; // USDT, when the universe was built; null for founders (always liquid)
  greeting: Partial<Record<Mood, string>>;
};

const founder = (id: Family, name: string, ticker: string, company: string, maxLever: number, kind: Kind, greeting: Species['greeting']): Species => ({
  id, family: id, founder: true, name, species: FAMILIES[id].species, ticker, company, symbol: `${ticker}USDT`, kind, maxLever,
  wrongDetail: FAMILIES[id].wrongDetail, preIpo: kind === 'private', volume24h: null, greeting,
});

const FOUNDERS: Species[] = [
  founder('nova', 'Nova', 'NVDA', 'Nvidia', 100, 'stock', { chill: 'Sideways. Vibing.', nightowl: "Wall Street sleeps. I don't.", hungry: "Feed me and I'll hold the dip." }),
  founder('volt', 'Volt', 'TSLA', 'Tesla', 100, 'stock', { ecstatic: 'WE ARE SO BACK.', sulking: "Don't look at me.", fainted: 'I saw the light. It was a margin call.' }),
  founder('pip', 'Pip', 'AAPL', 'Apple', 100, 'stock', { happy: 'Green day. I bought a hat.', pajamas: 'Markets closed. Snacks open.' }),
  founder('booster', 'Booster', 'SPCX', 'SpaceX', 75, 'private', { nervous: "It's a dip. It's a healthy dip. Right?", nightowl: 'No opening bell to wait for.' }),
  // A private company with no share to close: this perpetual is the only market that
  // prices it at all, so Nimbus never has a night — it is always the only price.
  founder('nimbus', 'Nimbus', 'OPENAI', 'OpenAI', 20, 'private', { chill: 'Private company. Public feelings.', nightowl: 'There is no closing bell for me.' }),
  founder('lurk', 'Lurk', 'RDDT', 'Reddit', 20, 'stock', { nightowl: 'This is my hour.', chill: 'Reading. Not posting.' }),
];

// Same ticker, same default name, on every device and every rebuild.
const pickName = (f: FamilyInfo, ticker: string) => {
  let h = 0;
  for (const c of ticker) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return f.names[h % f.names.length];
};

type Listing = (typeof universe.listings)[number];
const listed = (l: Listing): Species => {
  const f = FAMILIES[l.family as Family];
  return {
    id: l.id, family: f.id, founder: false, name: pickName(f, l.ticker), species: f.species, ticker: l.ticker,
    company: l.company, symbol: l.symbol, kind: l.kind as Kind, maxLever: l.maxLever, wrongDetail: f.wrongDetail,
    preIpo: l.preIpo, volume24h: l.volume24h, greeting: {},
  };
};

export const SPECIES: Record<string, Species> = Object.fromEntries(
  [...FOUNDERS, ...universe.listings.filter((l) => FAMILIES[l.family as Family]).map(listed)].map((s) => [s.id, s]),
);
export const SPECIES_LIST = Object.values(SPECIES);
export const UNIVERSE_AS_OF = universe.asOf;

const BY_SYMBOL = new Map(SPECIES_LIST.map((s) => [s.symbol, s]));
export const bySymbol = (symbol: string) => BY_SYMBOL.get(symbol) ?? null;

const familyOf = (id: Species['id']) => SPECIES[id]?.family ?? (id as Family);
export const petImage = (id: Species['id'], mood: Mood | 'hero') => `/pets/${familyOf(id)}/${mood}.png`;
export const familyImage = (f: Family, mood: Mood | 'hero') => `/pets/${f}/${mood}.png`;
export const eggImage = (id: Species['id']) => `/pets/eggs/${familyOf(id)}.png`;
