'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Confetti } from '@/components/Confetti';
import { SPECIES, eggImage, petImage, type Species } from '@/lib/pets';
import { StockPicker } from '@/components/StockPicker';
import { PERSONALITIES, adoptPetRemote, type Personality } from '@/lib/store';
import { forgetRemote, syncPet } from '@/lib/sync';

// Finch's rule: egg → hatch → name → personality, inside the first minute, before any feature.
type Step = 'egg' | 'hatch' | 'name';

export default function Adopt() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('egg');
  const [pick, setPick] = useState<Species['id'] | null>(null);
  const [cracked, setCracked] = useState(false);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<Personality>('degen');
  const sp = pick ? SPECIES[pick] : null;

  const hatch = () => {
    if (!pick) return;
    setStep('hatch');
    setTimeout(() => setCracked(true), 1400);
    setTimeout(() => { setName(SPECIES[pick].name); setStep('name'); }, 3200);
  };
  const adopt = () => {
    if (!pick || !name.trim()) return;
    router.push('/?hatched=1'); // optimistic — the local pet exists immediately; the agent attaches when the API answers
    forgetRemote();
    void adoptPetRemote({ species: pick, name: name.trim().slice(0, 16), personality }).then(syncPet);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center">
        <span className="rounded-full border px-3 py-1.5 text-[12px] num" style={{ borderColor: 'var(--ink)' }}>
          {step === 'egg' ? 'Adopt' : step === 'hatch' ? 'Hatching' : 'Name & personality'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 'egg' && (
          <motion.section key="egg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h1 className="mt-5 text-center text-[32px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Pick a stock</h1>
            <p className="mb-4 mt-1 text-center text-[14px]" style={{ color: 'var(--muted)' }}>The stock decides which Stockling hatches. It will hold that stock&rsquo;s perpetual on Bitget.</p>
            <StockPicker pick={pick} onPick={setPick} />
            <div className="sticky bottom-0 -mx-4 mt-4 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6" style={{ background: 'linear-gradient(to bottom, transparent, var(--canvas) 40%)' }}>
              <button onClick={hatch} disabled={!pick} className="pill w-full text-[18px] disabled:opacity-40">
                {sp ? `Hatch ${sp.ticker} · ${sp.species.toLowerCase()}` : 'Pick a stock to hatch'}
              </button>
            </div>
          </motion.section>
        )}

        {step === 'hatch' && sp && (
          <motion.section key="hatch" className="flex flex-1 flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative grid h-72 w-72 place-items-center">
              {cracked && <Confetti />}
              <AnimatePresence mode="wait">
                {!cracked ? (
                  <motion.img key="egg" src={eggImage(sp.id)} alt="" className="h-56 w-56 object-contain"
                    animate={{ rotate: [0, -6, 6, -8, 8, -4, 4, 0], y: [0, -2, 0, -4, 0] }} transition={{ duration: 1.3, ease: 'easeInOut' }}
                    exit={{ scale: 1.3, opacity: 0, transition: { duration: 0.2 } }} />
                ) : (
                  <motion.img key="pet" src={petImage(sp.id, 'ecstatic')} alt="" className="h-64 w-64 object-contain"
                    initial={{ scale: 0.4, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} />
                )}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-[16px] font-semibold" style={{ color: 'var(--muted)' }}>{cracked ? `A ${sp.species.toLowerCase()}!` : 'Something is moving…'}</p>
          </motion.section>
        )}

        {step === 'name' && sp && (
          <motion.section key="name" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mx-auto mt-2 grid h-44 w-44 place-items-center">
              <img src={petImage(sp.id, 'happy')} alt="" className="h-44 w-44 object-contain" />
            </div>
            <label className="card mt-2 block px-4 py-3">
              <span className="block text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoFocus
                className="w-full bg-transparent text-[20px] font-bold outline-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }} />
            </label>
            <div className="mt-3 grid gap-2">
              {(Object.keys(PERSONALITIES) as Personality[]).map((k) => {
                const p = PERSONALITIES[k], on = personality === k;
                return (
                  <button key={k} onClick={() => setPersonality(k)} className="card flex items-center gap-3 px-4 py-3 text-left"
                    style={{ outline: on ? '3px solid var(--accent)' : '3px solid transparent', background: on ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface)' }}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-lg" style={{ background: 'var(--canvas)' }} aria-hidden>{p.icon}</span>
                    <span><span className="block text-[15px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{p.name}</span>
                      <span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{p.tagline}</span></span>
                    {on && <span className="ml-auto grid h-6 w-6 place-items-center rounded-full text-[12px]" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>The personality is also how it trades.</p>
            <button onClick={adopt} disabled={!name.trim()} className="pill mt-4 w-full text-[18px] disabled:opacity-40">Adopt {name.trim() || sp.name}</button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
