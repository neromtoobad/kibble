// NYSE session clock. The app's day/night theme, the pet's Energy and every strategy's idea of
// "the open" follow this, not the wall clock.
//
// The closure calendar is computed from the NYSE's own rules rather than fetched. It used to come
// from a Solana venue's public API, which listed the eve of each holiday as a closure too — so
// 2026-11-25, an ordinary Wednesday, read as shut — and only the home screen ever consulted it.
// Everything else, the strategy engine included, would have happily bought the open on
// Thanksgiving. Built in, every caller gets the same calendar and none of them needs the network.

export type Session = 'pre' | 'regular' | 'post' | 'overnight' | 'weekend' | 'holiday';

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const EARLY_CLOSE = 13 * 60;
const EXTENDED = 4 * 60; // pre-market opens 4h before the bell; after-hours runs 4h past the close

const ET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit',
});

function et(now: Date) {
  const parts = ET.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    year: Number(get('year')),
    weekday: get('weekday'),
    mins: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
  };
}

// ——— the calendar ———
// Plain calendar days as UTC midnights, so date arithmetic never meets a DST transition.

const MON = 1, THU = 4, FRI = 5, SAT = 6;
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

function nth(y: number, m: number, weekday: number, n: number) {
  const first = day(y, m, 1);
  return day(y, m, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7);
}

function last(y: number, m: number, weekday: number) {
  const end = day(y, m + 1, 0);
  return shift(end, -((end.getUTCDay() - weekday + 7) % 7));
}

/** A Saturday holiday closes the Friday before, a Sunday one the Monday after. */
function observed(d: Date) {
  const dow = d.getUTCDay();
  return dow === SAT ? shift(d, -1) : dow === 0 ? shift(d, 1) : d;
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return day(y, month, ((h + l - 7 * m + 114) % 31) + 1);
}

export type Calendar = { closed: Set<string>; early: Set<string> };
const calendars = new Map<number, Calendar>();

/** Full closures and 13:00 early closes for one year, as YYYY-MM-DD in New York. NYSE Rule 7.2. */
export function nyseCalendar(year: number): Calendar {
  const hit = calendars.get(year);
  if (hit) return hit;
  const closed = new Set<string>();
  const add = (d: Date) => closed.add(iso(d));

  // New Year's on a Saturday is not moved back: the Friday is the last session of the old year.
  const newYear = day(year, 1, 1);
  if (newYear.getUTCDay() !== SAT) add(observed(newYear));
  add(nth(year, 1, MON, 3));                          // Martin Luther King Jr. Day
  add(nth(year, 2, MON, 3));                          // Washington's Birthday
  add(shift(easter(year), -2));                       // Good Friday
  add(last(year, 5, MON));                            // Memorial Day
  if (year >= 2022) add(observed(day(year, 6, 19)));  // Juneteenth
  add(observed(day(year, 7, 4)));                     // Independence Day
  add(nth(year, 9, MON, 1));                          // Labor Day
  const thanksgiving = nth(year, 11, THU, 4);
  add(thanksgiving);
  add(observed(day(year, 12, 25)));                   // Christmas

  // The bell rings at 13:00 the day after Thanksgiving, and on the eves of Independence Day and
  // Christmas when those eves are ordinary weekdays rather than the observed holiday itself.
  const early = new Set([iso(shift(thanksgiving, 1))]);
  for (const eve of [day(year, 7, 3), day(year, 12, 24)]) {
    const dow = eve.getUTCDay();
    if (dow >= MON && dow <= FRI && !closed.has(iso(eve))) early.add(iso(eve));
  }

  const cal = { closed, early };
  calendars.set(year, cal);
  return cal;
}

// ——— the clock ———

export function nyseSession(now: Date = new Date()): Session {
  const { ymd, year, weekday, mins } = et(now);
  if (weekday === 'Sat' || weekday === 'Sun') return 'weekend';
  const { closed, early } = nyseCalendar(year);
  if (closed.has(ymd)) return 'holiday';
  const close = early.has(ymd) ? EARLY_CLOSE : CLOSE;
  if (mins >= OPEN - EXTENDED && mins < OPEN) return 'pre';
  if (mins >= OPEN && mins < close) return 'regular';
  if (mins >= close && mins < close + EXTENDED) return 'post';
  return 'overnight';
}

/**
 * The next opening bell strictly after `now`, epoch ms. bStock rows carry no nextOpenTime, so
 * without this half the market cannot say when its reference leg starts moving again.
 */
export function nextOpen(now: Date = new Date()): number {
  let d = new Date(`${et(now).ymd}T00:00:00Z`);
  for (let i = 0; i < 14; i++, d = shift(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === SAT || nyseCalendar(d.getUTCFullYear()).closed.has(iso(d))) continue;
    // 09:30 in New York is 13:30 UTC under EDT and 14:30 under EST. DST switches at 02:00, so
    // the bell itself is never ambiguous.
    const edt = d.getTime() + OPEN * 60_000 + 4 * 3600_000;
    const t = et(new Date(edt)).mins === OPEN ? edt : edt + 3600_000;
    if (t > now.getTime()) return t;
  }
  throw new Error('no NYSE session in the next two weeks'); // unreachable: no closure lasts that long
}

export const isNight = (s: Session) => s === 'overnight' || s === 'weekend' || s === 'holiday';

export const sessionLabel: Record<Session, string> = {
  pre: 'NYSE pre-market',
  regular: 'NYSE open · regular session',
  post: 'NYSE after-hours',
  overnight: 'NYSE closed · overnight session',
  weekend: 'NYSE closed · weekend',
  holiday: 'NYSE closed · holiday',
};
