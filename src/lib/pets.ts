// Species registry — the home stock decides the species. Every one of these trades on
// Bitget as a tokenized-stock perpetual (rToken), verified live against the contracts
// endpoint: the symbol, the exchange's own leverage ceiling, and the 8-hour funding
// clock are pulled from there, not invented here.
//
// `maxLever` is the exchange's cap for that contract and doubles as a species trait —
// a robot cat can take more risk than a cloud. The strategies cap themselves well below it.

export const MOODS = [
  'ecstatic', 'happy', 'chill', 'nervous', 'sulking', 'nightowl', 'pajamas', 'hungry', 'fainted',
] as const;
export type Mood = (typeof MOODS)[number];

export type Species = {
  id: 'nova' | 'volt' | 'pip' | 'booster' | 'nimbus' | 'lurk';
  name: string;         // default pet name
  species: string;      // what it is
  ticker: string;       // home stock
  symbol: string;       // Bitget perpetual
  maxLever: number;     // the exchange's ceiling for this contract
  wrongDetail: string;  // the one deliberate flaw
  preIpo: boolean;      // no public share behind it — the perp is the only market there is
  greeting: Partial<Record<Mood, string>>;
};

export const SPECIES: Record<Species['id'], Species> = {
  nova: {
    id: 'nova', name: 'Nova', species: 'Robot cat', ticker: 'NVDA', symbol: 'NVDAUSDT', maxLever: 100,
    wrongDetail: 'left ear bent', preIpo: false,
    greeting: { chill: 'Sideways. Vibing.', nightowl: "Wall Street sleeps. I don't.", hungry: "Feed me and I'll hold the dip." },
  },
  volt: {
    id: 'volt', name: 'Volt', species: 'Lightning dog', ticker: 'TSLA', symbol: 'TSLAUSDT', maxLever: 100,
    wrongDetail: 'right ear folded', preIpo: false,
    greeting: { ecstatic: 'WE ARE SO BACK.', sulking: "Don't look at me.", fainted: 'I saw the light. It was a margin call.' },
  },
  pip: {
    id: 'pip', name: 'Pip', species: 'Earbud hedgehog', ticker: 'AAPL', symbol: 'AAPLUSDT', maxLever: 100,
    wrongDetail: 'one bent spine', preIpo: false,
    greeting: { happy: 'Green day. I bought a hat.', pajamas: 'Markets closed. Snacks open.' },
  },
  booster: {
    id: 'booster', name: 'Booster', species: 'Space frog', ticker: 'SPCX', symbol: 'SPCXUSDT', maxLever: 75,
    wrongDetail: 'mismatched eyes, crooked patch', preIpo: true,
    greeting: { nervous: "It's a dip. It's a healthy dip. Right?", nightowl: 'No opening bell to wait for.' },
  },
  nimbus: {
    id: 'nimbus', name: 'Nimbus', species: 'Cloud', ticker: 'OPENAI', symbol: 'OPENAIUSDT', maxLever: 20,
    wrongDetail: 'drooping puff', preIpo: true,
    // A private company with no share to close: this perpetual is the only market that
    // prices it at all, so Nimbus never has a night — it is always the only price.
    greeting: { chill: 'Private company. Public feelings.', nightowl: 'There is no closing bell for me.' },
  },
  lurk: {
    id: 'lurk', name: 'Lurk', species: 'Night owl', ticker: 'RDDT', symbol: 'RDDTUSDT', maxLever: 20,
    wrongDetail: 'one eye half closed', preIpo: false,
    greeting: { nightowl: 'This is my hour.', chill: 'Reading. Not posting.' },
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
export const bySymbol = (symbol: string) => SPECIES_LIST.find((s) => s.symbol === symbol) ?? null;

export const petImage = (id: Species['id'], mood: Mood | 'hero') =>
  // `fainted` reuses the sulking art — one fewer asset to generate, and a fainted pet
  // sulking is right anyway.
  `/pets/${id}/${mood === 'fainted' ? 'sulking' : mood}.png`;
