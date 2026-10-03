'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPECIES_LIST, petImage } from '@/lib/pets';

// One app for a phone and a desk. On a phone it is a single column with a tab bar at the bottom. On a
// tablet the column widens. On a wide screen a top bar takes over navigation, the pet's column widens,
// and the rest of the screen becomes the desk: a review path for anyone judging the claims, the board,
// and the newest things the agents decided, all live. Pages that are already wide (Proof) get the
// whole width under the top bar instead.
//
// Widths add up so nothing overflows: lg is 560 + 32 + 360 (+48 padding) = 1000 <= 1024, and xl is
// 640 + 40 + 380 (+48) = 1108 <= 1280.

const WIDE = ['/proof'];
export const isWide = (path: string) => WIDE.some((w) => path.startsWith(w));

export const TABS = [
  { href: '/', label: 'Pet', icon: '🐾' },
  { href: '/shelf', label: 'Shelf', icon: '🧸' },
  { href: '/duels', label: 'Board', icon: '🏆' },
  { href: '/diary', label: 'Diary', icon: '📓' },
  // For anyone checking the claims: scores, what the risk layer was worth, the model against its
  // own fixed-rule twin, the promises, and the hash chain verified in the browser.
  { href: '/proof', label: 'Proof', icon: '🔎' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <TopBar path={path} />
      {isWide(path) ? children : (
        <div className="lg:flex lg:items-start lg:justify-center lg:gap-8 lg:px-6 xl:gap-10">
          <div className="min-w-0 lg:w-[560px] lg:shrink-0 xl:w-[640px]">{children}</div>
          <Desk />
        </div>
      )}
    </>
  );
}

const active = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** The wide screen's navigation: the phone's tab bar steps aside for it. */
function TopBar({ path }: { path: string }) {
  return (
    <header className="sticky top-0 z-20 hidden border-b backdrop-blur lg:block" style={{ background: 'color-mix(in srgb, var(--canvas) 88%, transparent)', borderColor: 'var(--line)' }}>
      <div className="mx-auto flex h-16 items-center gap-6 px-6 lg:max-w-[1000px] xl:max-w-[1108px]">
        <Link href="/" className="text-[24px] font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>Kibble</Link>
        <nav className="flex items-center gap-1" aria-label="Sections">
          {TABS.map((t) => {
            const on = active(path, t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
                className="rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors hover:bg-[var(--surface)]"
                style={on ? { background: 'var(--ink)', color: 'var(--canvas)' } : { color: 'var(--muted)' }}>
                <span aria-hidden className="mr-1.5">{t.icon}</span>{t.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden whitespace-nowrap text-[12px] num xl:inline" style={{ color: 'var(--muted)' }}>paper trading on Bitget · since 20 Sep</span>
        <Link href="/adopt" className="ml-auto shrink-0 whitespace-nowrap rounded-full xl:ml-0 px-4 py-2 text-[14px] font-semibold transition-transform hover:scale-[1.03] active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'var(--font-display)' }}>Adopt a pet</Link>
      </div>
    </header>
  );
}

const PATH = [
  { href: '/', title: 'Meet a pet', text: 'An AI agent holding a Bitget stock perpetual. Funding is its food; liquidation makes it faint.' },
  { href: '/diary', title: 'Read its mind', text: 'Every decision in its own words, citing the news it read.' },
  { href: '/proof#promises', title: 'Check its promises', text: 'Every buy is a thesis with a target, a stop and a deadline, graded as it ends.' },
  { href: '/proof#guardian', title: 'Price the risk layer', text: 'What each veto and each cut saved or cost, 24 hours later.' },
  { href: '/proof#twin', title: 'Model against its twin', text: 'The same pet on its fixed rules alone, on the same tape.' },
  { href: '/proof#chain', title: 'Verify the diary', text: 'Every row is hash-chained; recompute it in your own browser.' },
  { href: '/adopt', title: `Adopt any of ${SPECIES_LIST.length}`, text: 'Every liquid Bitget stock perpetual, hatching the animal of its sector.' },
];

type Board = { id: string; name: string; species: string; ticker: string; personality: string; execution: string | null; returnPct: number | null; faints: number };
type Feed = { ts: number; kind: string; text: string; by: string | null; agent: string; species: string; ticker: string; outcome: string | null };

const ICON: Record<string, string> = { decided: '🧠', promise: '🤙', open: '📈', add: '➕', trim: '✂️', flatten: '⏹', vetoed: '🛑', liquidated: '💀' };
const OUTCOME: Record<string, { label: string; color?: string }> = {
  made: { label: 'promised' }, target: { label: 'right', color: 'var(--up)' }, stopped: { label: 'wrong', color: 'var(--down)' },
  expired: { label: 'ran out' }, closed: { label: 'closed early' },
};
const ago = (ms: number) => (ms < 60e3 ? 'just now' : ms < 3600e3 ? `${Math.round(ms / 60e3)}m ago` : ms < 86400e3 ? `${Math.round(ms / 3600e3)}h ago` : `${Math.round(ms / 86400e3)}d ago`);
const get = <T,>(url: string): Promise<T | null> => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

function Desk() {
  const [board, setBoard] = useState<Board[] | null>(null);
  const [feed, setFeed] = useState<Feed[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // Only a wide screen shows the desk, so only a wide screen pays for its requests.
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    let alive = true;
    const load = async () => {
      const [b, f] = await Promise.all([get<{ rows: Board[] }>('/api/leaderboard'), get<{ rows: Feed[] }>('/api/feed?limit=10')]);
      if (!alive) return;
      if (b) setBoard(b.rows); // already ranked by return
      if (f) setFeed(f.rows);
      setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[360px] shrink-0 overflow-y-auto py-6 lg:block xl:w-[380px]" aria-label="Desk">
      <section className="card px-4 py-4">
        <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Kibble in 90 seconds</h2>
        <ol className="mt-2 grid gap-2">
          {PATH.map((p, i) => (
            <li key={p.href}>
              <Link href={p.href} className="flex gap-2.5 rounded-2xl px-1 py-1 transition-colors hover:bg-[var(--canvas)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold num" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold leading-tight">{p.title}</span>
                  <span className="block text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>{p.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="card mt-3 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Board{board ? <span className="ml-1.5 text-[12px] font-medium num" style={{ color: 'var(--muted)' }}>{board.length} live</span> : null}</h2>
          <Link href="/duels" className="text-[12px] font-semibold hover:underline" style={{ color: 'var(--muted)' }}>all →</Link>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {(board ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-2.5">
              <img src={petImage(r.species, 'hero')} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-tight"><Link href={`/p/${r.id}`} className="hover:underline">{r.name}</Link> <span className="num text-[11.5px] font-medium" style={{ color: 'var(--muted)' }}>{r.ticker}</span></span>
                <span className="block text-[11.5px] leading-tight" style={{ color: 'var(--muted)' }}>{r.personality}{r.execution === 'demo' ? ' · Bitget demo' : ' · simulated'}{r.faints ? ` · fainted ${r.faints}×` : ''}</span>
              </span>
              <span className="num text-[13px] font-semibold" style={{ color: r.returnPct == null || r.returnPct === 0 ? undefined : r.returnPct > 0 ? 'var(--up)' : 'var(--down)' }}>
                {r.returnPct == null ? 'new' : `${r.returnPct > 0 ? '+' : ''}${r.returnPct.toFixed(2)}%`}
              </span>
            </li>
          ))}
          {!board && <li className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Loading the board…</li>}
        </ul>
      </section>

      <section className="card mt-3 px-4 py-4">
        <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Just now</h2>
        <ul className="mt-2 grid gap-2.5">
          {(feed ?? []).map((e, i) => {
            const o = e.outcome ? OUTCOME[e.outcome] : null;
            return (
              <li key={`${e.ts}-${e.kind}-${i}`} className="flex gap-2.5">
                <img src={petImage(e.species, e.kind === 'promise' && e.outcome === 'stopped' ? 'sulking' : 'chill')} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
                <span className="min-w-0">
                  <span className="block text-[11.5px] num" style={{ color: 'var(--muted)' }}>
                    <span aria-hidden>{ICON[e.kind] ?? '•'}</span> {e.agent} · {e.ticker} · {now ? ago(now - e.ts) : ''}
                    {o && <span className="ml-1 font-semibold" style={{ color: o.color }}>· {o.label}</span>}
                  </span>
                  <span className="line-clamp-2 text-[12.5px] leading-snug">{e.text}</span>
                </span>
              </li>
            );
          })}
          {!feed && <li className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Loading…</li>}
        </ul>
      </section>
    </aside>
  );
}
