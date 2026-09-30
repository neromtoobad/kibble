'use client';
import { useMemo, useState } from 'react';
import { FAMILY_LIST, FAMILIES, SPECIES_LIST, eggImage, familyImage, type Family, type Species } from '@/lib/pets';

// Choosing what to adopt, out of every stock perpetual liquid enough to trade honestly. Search by
// ticker, company or animal; the family chips double as a legend for which animal means what.
// With nothing typed, the six founders lead and the rest follow by how much trades on Bitget.

const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : `$${Math.round(v / 1e3)}k`);
const TAG: Record<Species['kind'], string | null> = { stock: null, etf: 'ETF', index: 'index', private: 'pre-IPO' };
const COUNT = Object.fromEntries(FAMILY_LIST.map((f) => [f.id, SPECIES_LIST.filter((s) => s.family === f.id).length])) as Record<Family, number>;

export function StockPicker({ pick, onPick }: { pick: string | null; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<Family | 'all'>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (s: Species) =>
      !q || s.ticker.toLowerCase().startsWith(q) || s.company.toLowerCase().includes(q)
      || s.species.toLowerCase().includes(q) || FAMILIES[s.family].sector.toLowerCase().includes(q);
    const rank = (s: Species) => (q && s.ticker.toLowerCase() === q ? 2 : 0) + (s.founder && !q ? 1 : 0);
    return SPECIES_LIST.filter((s) => (family === 'all' || s.family === family) && hit(s))
      .sort((a, b) => rank(b) - rank(a) || (b.volume24h ?? Infinity) - (a.volume24h ?? Infinity));
  }, [query, family]);

  return (
    <div>
      <label className="card flex items-center gap-2 px-4 py-2.5">
        <span aria-hidden style={{ color: 'var(--muted)' }}>⌕</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${SPECIES_LIST.length} stocks or animals`} aria-label="Search by ticker, company or animal"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]" style={{ color: 'var(--ink)' }} />
        {query && <button onClick={() => setQuery('')} className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }} aria-label="Clear search">✕</button>}
      </label>

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        <Chip on={family === 'all'} onClick={() => setFamily('all')}>All</Chip>
        {FAMILY_LIST.map((f) => (
          <Chip key={f.id} on={family === f.id} onClick={() => setFamily(family === f.id ? 'all' : f.id)}>
            <img src={familyImage(f.id, 'hero')} alt="" className="-my-1 -ml-1 h-6 w-6 object-contain" draggable={false} />
            {f.sector} <span className="num opacity-60">{COUNT[f.id]}</span>
          </Chip>
        ))}
      </div>

      {family !== 'all' && (
        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {FAMILIES[family].sector} hatch a <span style={{ color: 'var(--ink)' }}>{FAMILIES[family].species.toLowerCase()}</span>.
        </p>
      )}

      {/* A flex column, not a grid: a grid track grows to the widest row's min-content, and a
          nowrap company name would widen every row past the screen instead of truncating. */}
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((s) => {
          const on = pick === s.id, tag = TAG[s.kind];
          return (
            <li key={s.id}>
              <button onClick={() => onPick(s.id)} className="card flex w-full items-center gap-3 px-3 py-2 text-left transition-transform active:scale-[0.99]"
                style={{ outline: on ? '3px solid var(--accent)' : '3px solid transparent', boxShadow: on ? 'var(--glow)' : 'none' }} aria-pressed={on}
                aria-label={`${s.ticker}, ${s.company}${tag ? `, ${tag}` : ''} — hatches a ${s.species.toLowerCase()}`}>
                <img src={eggImage(s.id)} alt="" className="h-12 w-10 shrink-0 object-contain" draggable={false} loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{s.ticker}</span>
                    {s.founder && <Badge>founder</Badge>}
                    {tag && <Badge>{tag}</Badge>}
                  </span>
                  <span className="block truncate text-[12.5px]" style={{ color: 'var(--muted)' }}>{s.company}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12px] font-semibold">{s.species}</span>
                  <span className="block text-[11px] num" style={{ color: 'var(--muted)' }}>{s.volume24h ? `${usd(s.volume24h)}/day` : `up to ${s.maxLever}×`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!list.length && (
        <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
          Nothing matches. Only Bitget stock perpetuals that trade at least $250k a day are adoptable.
        </p>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold"
      style={on ? { background: 'var(--ink)', color: 'var(--canvas)', borderColor: 'var(--ink)' } : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}>
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--canvas)', color: 'var(--muted)' }}>{children}</span>;
}
