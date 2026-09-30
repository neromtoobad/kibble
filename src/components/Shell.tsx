'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPECIES_LIST, petImage } from '@/lib/pets';

// The app is a phone app. On a wide screen it stays one — the column a pet lives in — and the rest
// of the screen becomes the desk: navigation, a review path for anyone judging the claims, the
// board, and the newest things the agents decided, all live. Pages that are already wide (Proof)
// get the whole width instead.

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
  if (isWide(path)) return <>{children}</>;
  return (
    <div className="lg:flex lg:items-start lg:justify-center lg:gap-10 lg:px-6">
      <div className="min-w-0 lg:w-[430px] lg:shrink-0">{children}</div>
      <Desk path={path} />
    </div>
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

type Board = { id: string; name: string; species: string; ticker: string; personality: string; execution: string | null; pnlPct: number | null; faints: number };
type Feed = { ts: number; kind: string; text: string; by: string | null; agent: string; species: string; ticker: string; outcome: string | null };

const ICON: Record<string, string> = { decided: '🧠', promise: '🤙', open: '📈', add: '➕', trim: '✂️', flatten: '⏹', vetoed: '🛑', liquidated: '💀' };
const OUTCOME: Record<string, { label: string; color?: string }> = {
  made: { label: 'promised' }, target: { label: 'right', color: 'var(--up)' }, stopped: { label: 'wrong', color: 'var(--down)' },
  expired: { label: 'ran out' }, closed: { label: 'closed early' },
};
const ago = (ms: number) => (ms < 60e3 ? 'just now' : ms < 3600e3 ? `${Math.round(ms / 60e3)}m ago` : ms < 86400e3 ? `${Math.round(ms / 3600e3)}h ago` : `${Math.round(ms / 86400e3)}d ago`);
const get = <T,>(url: string): Promise<T | null> => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

function Desk({ path }: { path: string }) {
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
      if (b) setBoard([...b.rows].sort((x, y) => (y.pnlPct ?? -1e9) - (x.pnlPct ?? -1e9)));
      if (f) setFeed(f.rows);
      setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[380px] shrink-0 overflow-y-auto py-6 lg:block" aria-label="Desk">
      <div className="flex items-baseline justify-between">
        <p className="text-[26px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Kibble</p>
        <p className="text-[12px] num" style={{ color: 'var(--muted)' }}>{board ? `${board.length} agents live` : 'live'} · paper since 20 Sep</p>
      </div>
      <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Sections">
        {TABS.map((t) => {
          const on = t.href === '/' ? path === '/' : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="rounded-full border px-3 py-1.5 text-[13px] font-semibold"
              style={on ? { background: 'var(--ink)', color: 'var(--canvas)', borderColor: 'var(--ink)' } : { background: 'var(--surface)', borderColor: 'var(--line)' }}>
              <span aria-hidden className="mr-1">{t.icon}</span>{t.label}
            </Link>
          );
        })}
      </nav>

      <section className="card mt-5 px-4 py-4">
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
          <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Board</h2>
          <Link href="/duels" className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>all →</Link>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {(board ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-2.5">
              <img src={petImage(r.species, 'hero')} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-tight"><Link href={`/p/${r.id}`} className="hover:underline">{r.name}</Link> <span className="num text-[11.5px] font-medium" style={{ color: 'var(--muted)' }}>{r.ticker}</span></span>
                <span className="block text-[11.5px] leading-tight" style={{ color: 'var(--muted)' }}>{r.personality}{r.execution === 'demo' ? ' · Bitget demo' : ' · simulated'}{r.faints ? ` · fainted ${r.faints}×` : ''}</span>
              </span>
              <span className="num text-[13px] font-semibold" style={{ color: r.pnlPct == null || r.pnlPct === 0 ? undefined : r.pnlPct > 0 ? 'var(--up)' : 'var(--down)' }}>
                {r.pnlPct == null ? '—' : `${r.pnlPct > 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%`}
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
                  <span className="line-clamp-2 block text-[12.5px] leading-snug">{e.text}</span>
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
