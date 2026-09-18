'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pet } from '@/components/Pet';
import { Ring } from '@/components/Ring';
import { Nav } from '@/components/Nav';
import { Confetti } from '@/components/Confetti';
import { Report, Ask } from '@/components/Report';
import { Sparkline } from '@/components/Sparkline';
import { DuelCard, type Duel } from '@/components/Duel';
import { SPECIES, type Mood } from '@/lib/pets';
import { computeMood, moodLine } from '@/lib/mood';
import { isNight, nyseSession, sessionLabel } from '@/lib/session';
import { useLocal, useNow, useSearch } from '@/lib/client';
import { runEngine } from '@/lib/engine';
import type { Judgement } from '@/lib/brain';
import { pullPet, syncPet } from '@/lib/sync';
import { answerProposal, hunger as hungerOf, isPaper, leverage, liquidationDistance, liquidationPrice, mergeEntries, pnl, readPet, savePet, touchVisit, usePet, waitingLine, type Entry } from '@/lib/store';
import { fundingApr } from '@/lib/strategy';
import type { Bar } from '@/lib/bitget';

type Price = { price: number | null; pct24h: number; source: string; fundingApr?: number; basisPct?: number; indexPrice?: number | null };

export default function Home() {
  const router = useRouter();
  const pet = usePet();
  const hasStore = useLocal('stocklings.pet') !== null;
  const now = useNow();
  const q = useSearch();
  const [price, setPrice] = useState<Price>({ price: null, pct24h: 0, source: 'none' });
  const [bars, setBars] = useState<Bar[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>();
  const [report, setReport] = useState<{ fresh: Entry[]; awayMs: number } | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const remoteId = useLocal('stocklings.remoteId');

  const species = pet?.species ?? 'nova';
  const celebrate = Boolean(q.get('hatched') || q.get('fed') || q.get('public'));

  useEffect(() => { if (now && !pet) router.replace('/adopt'); }, [now, pet, router]);
  useEffect(() => { if (pet) touchVisit(pet); }, [pet?.lastVisitDay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }, 1400);
    return () => clearTimeout(t);
  }, [celebrate]);
  useEffect(() => {
    let alive = true;
    fetch('/api/holidays').then((r) => r.json()).then((j: { dates: string[] }) => { if (alive) setHolidays(new Set(j.dates)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Price, history, and the catch-up tick all hang off one load.
  useEffect(() => {
    let alive = true;
    fetch(`/api/price/${species}`).then((r) => r.json()).then((p: Price) => { if (alive) setPrice(p); }).catch(() => {});
    fetch(`/api/history/${species}`).then((r) => r.json()).then(async (j: { bars: Bar[]; funding?: Array<{ t: number; rate: number }> }) => {
      if (!alive || !j.bars?.length) return;
      setBars(j.bars);
      let current = readPet();
      if (!current) return;
      const since = current.lastTickAt || current.adoptedAt;

      // The hourly worker keeps ticking with nobody watching, so the server's copy can be ahead of
      // this browser's. Adopt it first, then replay only what is genuinely left.
      const pulled = await pullPet(current);
      if (!alive) return;
      const overnight = pulled?.entries ?? [];
      if (pulled) { current = mergeEntries({ ...current, ...pulled.pet }, pulled.entries); savePet(current); }

      // ?rewind=48 pretends you were away that many hours, so the engine has a window to replay.
      // Dev and demo only — it moves the watermark, never invents prices.
      const rewind = Number(new URLSearchParams(window.location.search).get('rewind'));
      const seed = rewind > 0 ? { ...current, lastTickAt: Date.now() - rewind * 3600e3 } : current;

      // Ask the pet what it makes of the news before replaying. The model runs server-side (the
      // key never reaches the browser) and its answer is an input to the engine, exactly as it
      // is for the hourly worker — same route to the same place. No key, or nothing new to
      // read, and this is null: the pet falls back to its fixed rules.
      const last = j.bars.at(-1);
      const judgement = last ? await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet: seed, price: last.close, fundingRate: j.funding?.at(-1)?.rate ?? 0 }),
      }).then((r) => r.json()).then((x: { judgement: Judgement | null }) => x.judgement).catch(() => null) : null;
      if (!alive) return;

      const res = runEngine(seed, j.bars, j.funding ?? [], Date.now(), judgement);
      savePet(res.pet);
      const fresh = [...overnight, ...res.fresh];
      if (fresh.length) setReport({ fresh, awayMs: res.to - since });
      void syncPet(res.pet, res.fresh); // only what happened here; the worker's lines are already stored
    }).catch(() => {});
    return () => { alive = false; };
  }, [species]);

  // An open duel belongs on the screen you actually look at, not only on the Board.
  useEffect(() => {
    if (!remoteId) return;
    let alive = true;
    fetch('/api/duel').then((r) => r.json()).then((j: { duels: Duel[] }) => {
      if (!alive) return;
      setDuel(j.duels?.find((d) => !d.settledAt && (d.a === remoteId || d.b === remoteId)) ?? null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [remoteId]);

  const session = q.get('night') ? 'overnight' : nyseSession(now ? new Date(now) : new Date(), holidays);
  const night = isNight(session);
  useEffect(() => { document.documentElement.dataset.session = night ? 'night' : 'day'; }, [night]);

  const sp = SPECIES[species];
  // Hunger is the engine's own: time since the last feed AND the funding this position
  // has paid since then. A pet carrying an expensive position gets hungry faster.
  const hunger = pet && now ? hungerOf(pet, now) : 1;
  const energy = session === 'regular' ? 0.95 : session === 'pre' || session === 'post' ? 0.7 : 0.4;
  const bond = Math.min(1, 0.15 + (pet?.streak ?? 1) * 0.12);
  const liqDist = pet && price.price ? liquidationDistance(pet, price.price) : null;
  const fainted = Boolean(pet && pet.faints > 0 && !pet.position && pet.margin < 1);
  const computed = useMemo(
    () => computeMood({ pct24h: price.pct24h, session, hunger, fainted, liqDistPct: liqDist, fundingApr: price.fundingApr, preIpo: sp.preIpo }),
    [price.pct24h, price.fundingApr, session, hunger, fainted, liqDist, sp.preIpo],
  );
  const mood = celebrate ? 'ecstatic' : ((q.get('mood') as Mood | null) ?? computed);
  const line = celebrate
    ? (q.get('hatched') ? 'Hi. I live here now.' : q.get('public') ? 'We rang the bell.' : 'CHOMP. Thank you.')
    : moodLine(mood, price.pct24h, sp.ticker, price.fundingApr);

  const qty = pet?.position?.qty ?? 0;
  const perf = pet && price.price ? pnl(pet, price.price) : null;
  const lev = pet && price.price ? leverage(pet, price.price) : 0;
  const liqPx = pet ? liquidationPrice(pet) : null;

  if (!hasStore && !pet) return <main className="min-h-dvh" />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 pb-24 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <span className="rounded-full border px-3 py-1.5 text-[12px] num" style={{ borderColor: night ? 'var(--accent)' : 'var(--ink)', color: night ? 'var(--accent)' : 'var(--ink)', boxShadow: night ? 'var(--glow)' : 'none' }}>
          {night ? '☾' : '☀'} {sessionLabel[session]}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{pet?.name ?? sp.name} · day {pet?.streak ?? 1}</span>
      </div>

      <div className="relative mt-5 flex flex-col items-center">
        <div className="card relative mb-2 max-w-[264px] px-4 py-2.5 text-center text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {line}
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45" style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }} aria-hidden />
        </div>
        <div className="relative">
          {celebrate && <Confetti />}
          <Pet id={species} mood={mood} night={night} size={300} />
        </div>
      </div>

      {/* Equity — the number that moves without you, and what it costs to keep it. */}
      {pet && (
        <div className="card mt-1 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>Equity {isPaper(pet) && <span className="num">· paper</span>}</p>
              <p className="text-[24px] font-bold num leading-tight">{perf ? `$${perf.equity.toFixed(2)}` : '—'}</p>
              {perf && perf.basis > 0 && (
                <p className="text-[12.5px] num" style={{ color: perf.unrealized >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {perf.unrealized >= 0 ? '+' : ''}${perf.unrealized.toFixed(2)} ({perf.unrealized >= 0 ? '+' : ''}{perf.pct.toFixed(2)}%) unrealised
                </p>
              )}
            </div>
            <Sparkline marks={pet.marks ?? []} />
          </div>

          {pet.position ? (
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t pt-2.5" style={{ borderColor: 'var(--line)' }}>
              <div>
                <p className="text-[10.5px]" style={{ color: 'var(--muted)' }}>Position</p>
                <p className="text-[13px] num">{qty.toFixed(3)} <span style={{ color: 'var(--muted)' }}>@ ${pet.position.entry.toFixed(2)}</span></p>
                <p className="text-[11px] num" style={{ color: 'var(--muted)' }}>{lev.toFixed(1)}× leverage</p>
              </div>
              <div>
                {/* The distance to liquidation is the whole tension of a perpetual. */}
                <p className="text-[10.5px]" style={{ color: 'var(--muted)' }}>Liquidation</p>
                <p className="text-[13px] num" style={{ color: liqDist !== null && liqDist < 15 ? 'var(--down)' : 'var(--ink)' }}>
                  {liqPx ? `$${liqPx.toFixed(2)}` : '—'}
                </p>
                <p className="text-[11px] num" style={{ color: liqDist !== null && liqDist < 15 ? 'var(--down)' : 'var(--muted)' }}>
                  {liqDist !== null ? `${liqDist.toFixed(1)}% away` : '—'}
                </p>
              </div>
              <div>
                {/* What it pays every 8 hours simply to still be in the trade. */}
                <p className="text-[10.5px]" style={{ color: 'var(--muted)' }}>Funding</p>
                <p className="text-[13px] num" style={{ color: (price.fundingApr ?? 0) > 0 ? 'var(--down)' : 'var(--up)' }}>
                  {price.fundingApr !== undefined ? `${price.fundingApr > 0 ? '+' : ''}${price.fundingApr.toFixed(0)}%/yr` : '—'}
                </p>
                <p className="text-[11px] num" style={{ color: 'var(--muted)' }}>paid ${pet.fundingPaid.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2.5 border-t pt-2.5 text-[12.5px]" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              Flat · ${pet.margin.toFixed(2)} margin{pet.faints > 0 && <> · fainted {pet.faints}×</>}
            </p>
          )}
        </div>
      )}

      {pet && <Ask pet={pet} price={price.price} onAnswer={(yes) => { if (price.price) void syncPet(answerProposal(pet, yes, price.price)); }} />}

      {duel && (
        <Link href="/duels" className="mt-2 block">
          <DuelCard duel={duel} mine={remoteId} />
        </Link>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Ring label="Hunger" value={hunger} icon="🍽" />
        <Ring label="Energy" value={energy} icon="⚡" />
        <Ring label="Bond" value={bond} icon="♥" />
      </div>

      <Link href="/feed" className="pill mt-5 grid w-full place-items-center text-[18px] active:scale-[0.98]" style={{ transition: 'transform .1s' }}>Feed $5</Link>

      <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
        {pet?.position
          ? <>holds <span className="num" style={{ color: 'var(--ink)' }}>{qty.toFixed(3)} {sp.ticker}</span> on <span className="num">${pet.margin.toFixed(0)}</span> margin</>
          : <>flat · <span className="num" style={{ color: 'var(--ink)' }}>${(pet?.margin ?? 0).toFixed(0)}</span> in the bowl</>}
      </p>
      {pet && pet.margin >= 1 && !pet.position && !pet.proposal && (
        <p className="mt-1 text-center text-[12px]" style={{ color: 'var(--muted)' }}>{waitingLine[pet.personality]}</p>
      )}

      {report && pet && <Report pet={pet} fresh={report.fresh} awayMs={report.awayMs} price={price.price} onClose={() => setReport(null)} />}
      <Nav />
    </main>
  );
}
