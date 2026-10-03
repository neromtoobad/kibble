'use client';
import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { FAMILY_LIST, FAMILIES, MOODS, SPECIES_LIST, familyImage, type Family, type Mood } from '@/lib/pets';

// The collection. Every family, every mood, the wrong detail called out — the shelf you'd show a
// friend. A family is one animal for one kind of business, so the card also lists which stocks
// hatch it.
export default function Shelf() {
  const [open, setOpen] = useState<Family>('nova');
  const [mood, setMood] = useState<Mood>('chill');
  const f = FAMILIES[open];
  const members = SPECIES_LIST.filter((s) => s.family === open)
    .sort((a, b) => Number(b.founder) - Number(a.founder) || (b.volume24h ?? 0) - (a.volume24h ?? 0));
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] md:max-w-[600px] lg:max-w-none lg:pt-6 flex-col px-4 pb-24 pt-[max(12px,env(safe-area-inset-top))] lg:pb-12">
      <h1 className="text-center text-[28px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Shelf</h1>
      <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>
        {FAMILY_LIST.length} Stocklings, {SPECIES_LIST.length} Bitget perpetuals. One wrong detail each.
      </p>

      <div className="card relative mt-4 flex flex-col items-center px-4 pb-4 pt-3">
        <div className="grid h-56 w-56 place-items-center">
          <img src={familyImage(open, mood)} alt={`${f.species} looking ${mood}`} className="h-56 w-56 object-contain" />
        </div>
        <p className="text-[22px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{f.species}</p>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{f.sector}</p>
        <p className="mt-1 text-[12.5px]" style={{ color: 'var(--muted)' }}>wrong detail: <span style={{ color: 'var(--ink)' }}>{f.wrongDetail}</span></p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {MOODS.map((m) => (
            <button key={m} onClick={() => setMood(m)} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold capitalize"
              style={mood === m ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { background: 'var(--canvas)', color: 'var(--muted)' }}>{m === 'nightowl' ? 'night owl' : m}</button>
          ))}
        </div>
        <p className="mt-3 text-center text-[12px] leading-relaxed num" style={{ color: 'var(--muted)' }}>
          {members.map((s, i) => (
            <span key={s.id}>{i > 0 && ' · '}<span style={s.founder ? { color: 'var(--ink)', fontWeight: 700 } : undefined}>{s.ticker}</span></span>
          ))}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-4">
        {FAMILY_LIST.map((x) => (
          <button key={x.id} onClick={() => { setOpen(x.id); setMood('chill'); }} className="card flex flex-col items-center gap-1 px-2 pb-2 pt-3"
            style={{ outline: open === x.id ? '3px solid var(--accent)' : '3px solid transparent' }}>
            <img src={familyImage(x.id, 'hero')} alt="" className="h-20 w-20 object-contain" draggable={false} />
            <span className="text-center text-[12.5px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{x.species}</span>
            <span className="-mt-0.5 text-center text-[10.5px] leading-tight" style={{ color: 'var(--muted)' }}>{x.sector}</span>
          </button>
        ))}
      </div>
      <Nav />
    </main>
  );
}
