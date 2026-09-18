import type { Mood } from './pets';
import type { Session } from './session';

export type MoodInput = {
  pct24h: number;          // home stock's perpetual, 24h change, percent
  session: Session;
  hunger: number;          // 0..1, 1 = just fed
  fainted?: boolean;       // liquidated and not yet fed back to life
  liqDistPct?: number | null; // how far the price is from the liquidation price
  fundingApr?: number;     // annualised cost of the carry, percent; positive = paying
  volSpike?: boolean;
  preIpo?: boolean;        // no public share behind it — the perp is the only market
};

// Deterministic. The order is the priority: a fainted pet is fainted no matter what the
// tape did, a pet near liquidation is nervous even on a green day, and hunger outranks
// price so the care loop is never masked by a rally. Only then does the market get a say.
export function computeMood(i: MoodInput): Mood {
  if (i.fainted) return 'fainted';
  if (i.liqDistPct !== null && i.liqDistPct !== undefined && i.liqDistPct < 10) return 'nervous';
  if (i.hunger < 0.33) return 'hungry';
  // A pre-IPO species has no closing bell to observe — its perpetual is the only market
  // that prices the company at all, so it never goes to sleep with the others.
  if (!i.preIpo && (i.session === 'weekend' || i.session === 'holiday')) return 'pajamas';
  if (!i.preIpo && i.session === 'overnight') return 'nightowl';
  if (i.pct24h >= 4) return 'ecstatic';
  if (i.pct24h >= 1) return 'happy';
  if (i.pct24h <= -4) return 'sulking';
  if (i.pct24h <= -1 || i.volSpike) return 'nervous';
  return 'chill';
}

export const moodLines: Record<Mood, string[]> = {
  ecstatic: ['WE ARE SO BACK.', 'Up only. Allegedly.', 'I bought a hat. Two hats. On margin.'],
  happy: ['Green day. I bought a hat.', "Told you. I didn't, but still."],
  chill: ['Sideways. Vibing.', 'Nothing happened. Perfect.'],
  nervous: ["It's a dip. It's a healthy dip. Right?", 'Everything is fine. Stop asking.', 'Do not look at my liquidation price.'],
  sulking: ["Don't look at me.", 'We do not speak of today.'],
  nightowl: ["Wall Street sleeps. I don't.", 'NYSE is closed. I am not.', 'The share stopped trading. I never do.'],
  pajamas: ['Markets closed. Snacks open.', 'Weekend rules: no charts.'],
  hungry: ['Feed me and I can hold this.', 'Funding ate my bowl. Again.', 'Empty margin. Empty bags.'],
  fainted: ['I saw the light. It was a margin call.', 'Liquidated. Feed me and I will try again.', 'Everything was fine until it very much was not.'],
};

/** A line the pet says, chosen deterministically so the same state always says the same thing. */
export function moodLine(mood: Mood, pct24h: number, ticker: string, fundingApr?: number): string {
  const pool = moodLines[mood];
  const pick = pool[Math.abs(Math.round(pct24h * 100)) % pool.length];
  const sign = pct24h >= 0 ? '+' : '';

  // When the carry is the story, say the carry instead of the price — it is the number
  // that decides whether this pet eats today.
  if (mood === 'hungry' && fundingApr !== undefined && fundingApr > 20) {
    return `Funding's ${fundingApr.toFixed(0)}% a year. ${pick}`;
  }
  return mood === 'nightowl' || mood === 'pajamas' || mood === 'hungry' || mood === 'fainted'
    ? pick
    : `${ticker} ${sign}${pct24h.toFixed(1)}%. ${pick}`;
}
