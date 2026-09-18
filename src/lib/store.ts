'use client';
import { useMemo } from 'react';
import { setLocal, useLocal } from './client';
import { isPaper, type Entry, type PetState, type Personality } from './pet-math';
import { SPECIES, type Species } from './pets';
import { MANDATES } from './strategy';

// Pet state as the browser holds it. Feeding adds cash; the strategy engine decides what to do with
// it. Those are separate on purpose — "you fed it" and "it bought something" are different events,
// and only the second one is the pet acting on its own.
//
// The shape and the arithmetic live in ./pet-math, which the server and the hourly worker share.

export * from './pet-math';

export const PERSONALITIES: Record<Personality, { name: string; tagline: string; icon: string }> = {
  diamond: { name: 'Diamond Hands', tagline: '2×, adds at every open, only ever trims to stay alive', icon: '💎' },
  degen:   { name: 'Degen',         tagline: '8× on 2% dips, any hour, six-hour cooldown',            icon: '⚡' },
  boomer:  { name: 'Boomer',        tagline: '1.5×, regular hours only, a third never deployed',      icon: '🕰' },
  quant:   { name: 'Quant',         tagline: '3×, weekly, and will not pay over 15%/yr to carry',     icon: '📊' },
  owl:     { name: 'Night Shift',   tagline: 'only acts while the NYSE is shut — 4×',                 icon: '🌙' },
};

const KEY = 'stocklings.pet';
const day = (t: number) => new Date(t).toLocaleDateString('en-CA');

export function usePet(): PetState | null {
  const raw = useLocal(KEY);
  return useMemo(() => {
    if (!raw) return null;
    try { return migrate(JSON.parse(raw)); } catch { return null; }
  }, [raw]);
}

/** A pet stored before the perpetual engine had no margin or position of its own. */
export function migrate(p: PetState & { cash?: number; lots?: unknown[]; lentQty?: number; yieldQty?: number }): PetState {
  if (p.margin !== undefined) return p;
  return {
    ...p,
    margin: p.cash ?? 0,
    position: null,
    realized: 0,
    fundingPaid: 0,
    faints: 0,
    marks: [],
    lastTickAt: p.lastTickAt ?? p.adoptedAt,
    proposal: null,
  };
}

export function savePet(p: PetState) { setLocal(KEY, JSON.stringify(p)); }
/** Read outside React — the engine runs in a fetch callback, not during render. */
export function readPet(): PetState | null {
  try { const raw = localStorage.getItem(KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch { return null; }
}

/** Fold entries the worker wrote while the app was closed into the local diary, newest last. */
export function mergeEntries(p: PetState, incoming: Entry[]): PetState {
  if (!incoming.length) return p;
  const seen = new Set(p.diary.map((e) => `${e.ts}:${e.kind}`));
  const add = incoming.filter((e) => !seen.has(`${e.ts}:${e.kind}`));
  if (!add.length) return p;
  return { ...p, diary: [...p.diary, ...add].sort((a, b) => a.ts - b.ts) };
}


// ——— lifecycle ———
export function adoptPet(init: { species: Species['id']; name: string; personality: Personality }): PetState {
  const t = Date.now();
  const p: PetState = {
    ...init, adoptedAt: t, lastFed: t, streak: 1, lastVisitDay: day(t),
    margin: 0, position: null, realized: 0, fundingPaid: 0, faints: 0,
    marks: [], lastTickAt: t, proposal: null,
    diary: [{ ts: t, text: hatchLine(init.personality, init.name), kind: 'system' }],
  };
  savePet(p);
  return p;
}

export function touchVisit(p: PetState): PetState {
  const today = day(Date.now());
  if (p.lastVisitDay === today) return p;
  const yesterday = day(Date.now() - 86_400_000);
  const next = { ...p, streak: p.lastVisitDay === yesterday ? p.streak + 1 : 1, lastVisitDay: today };
  savePet(next);
  return next;
}

/**
 * Feeding posts margin. What the pet does with it is the pet's call — "you fed it" and
 * "it opened something" are different events, and only the second is the pet acting.
 * A pet that fainted comes back the moment you feed it.
 */
export function feedPet(p: PetState, usd: number): PetState {
  const t = Date.now();
  const revived = p.faints > 0 && !p.position && p.margin < 1;
  const next: PetState = {
    ...p, lastFed: t, margin: p.margin + usd,
    diary: [
      ...p.diary,
      { ts: t, text: `Fed $${usd} of margin.`, kind: 'feed', usd },
      ...(revived ? [{ ts: t + 1, text: 'Back on my feet. Let us never speak of that again.', kind: 'system' as const }] : []),
    ],
  };
  savePet(next);
  return next;
}

// The adopt and feed screens call these. There is no exchange account behind a Stockling yet, so
// they do the local thing and mirror it to the board — execution stays paper, and `isPaper()` is
// the single place that decides so it cannot drift. Wiring a Bitget Agentic Account in means
// setting `agentId` here and nothing else changes shape.
export async function adoptPetRemote(init: { species: Species['id']; name: string; personality: Personality }): Promise<PetState> {
  return adoptPet(init);
}

export async function feedPetRemote(p: PetState, usd: number): Promise<PetState> {
  return feedPet(p, usd);
}

/** A Stockling that has earned a track record publishes its mandate as a Playbook. */
export function savePublished(p: PetState, playbook: string) {
  const ts = Date.now();
  savePet({ ...p, published: { playbook, ts }, diary: [...p.diary, { ts, text: `Rang the bell. ${p.name}'s mandate is published as a Playbook.`, kind: 'system', sig: playbook }] });
}

export function answerProposal(p: PetState, accept: boolean, price: number): PetState {
  if (!p.proposal) return p;
  const t = Date.now();
  if (!accept) {
    const next = { ...p, proposal: null, diary: [...p.diary, { ts: t, text: 'Fine. Not today.', kind: 'hold' as const }] };
    savePet(next);
    return next;
  }
  const usd = Math.min(p.proposal.usd, p.margin);
  const lever = Math.min(MANDATES[p.personality].maxLever, SPECIES[p.species].maxLever);
  const qty = (usd * lever) / price;
  const held = p.position?.qty ?? 0;
  const entry = held + qty > 0 ? ((held * (p.position?.entry ?? 0)) + qty * price) / (held + qty) : price;
  const next: PetState = {
    ...p,
    proposal: null,
    position: { qty: held + qty, entry, openedAt: p.position?.openedAt ?? t },
    diary: [...p.diary, {
      ts: t,
      text: `You said yes. ${held > 0 ? 'Added' : 'Opened'} ${qty.toFixed(4)} at $${price.toFixed(2)}, ${lever}×.`,
      kind: held > 0 ? ('add' as const) : ('open' as const),
      qty, price, usd, paper: isPaper(p),
    }],
  };
  savePet(next);
  return next;
}

// ——— voice ———
function hatchLine(v: Personality, name: string) {
  return {
    diamond: `${name} online. Two times, and I don't close. I barely know how.`,
    degen: `${name} HAS ENTERED THE CHAT. eight times. where's the dip`,
    boomer: `${name} here. Regular hours, one and a half times, and a third stays in the bowl.`,
    quant: `${name} initialized. I will not pay over fifteen percent a year to carry anything.`,
    owl: `${name} is awake. The bell means nothing to me — this thing trades all night.`,
  }[v];
}

export const waitingLine: Record<Personality, string> = {
  diamond: 'Holding it for the open. Every open, same thing.',
  degen: 'Sitting on it. Waiting for something to break.',
  boomer: 'It will be deployed during regular hours. Not before.',
  quant: 'Queued for the next rebalance — if the carry is cheap enough.',
  owl: 'Nothing happens until the bell. Then everything does.',
};
