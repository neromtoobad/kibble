import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { PromiseCard } from '@/components/PromiseCard';
import { loadCard } from '@/lib/card';
import { PERSONALITY_NAME } from '@/lib/card-image';
import { familyImage } from '@/lib/pets';

// A Stockling's public page: the link an owner posts, and what a stranger lands on. It unfurls to
// the share card (/api/card/<id>) and shows the same record behind it — return, promise, diary —
// with a way to adopt your own. Nothing private is on it.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await loadCard(id).catch(() => null);
  if (!c) return { title: 'Kibble' };
  const title = `${c.name} the ${c.species.toLowerCase()}${c.returnPct === null ? '' : ` · ${pct(c.returnPct)}`} on ${c.ticker} · Kibble`;
  const description = c.pinky
    ? `Pinky promise: "${c.pinky.thesis}" Right at $${c.pinky.target.toFixed(2)}, wrong at $${c.pinky.stop.toFixed(2)}.`
    : `An AI pet trading the ${c.ticker} perpetual on Bitget as a ${PERSONALITY_NAME[c.personality]}. Every decision in its own words, hash-chained.`;
  const image = { url: `/api/card/${c.id}`, width: 1200, height: 630, alt: `${c.name}'s Kibble card` };
  return {
    title, description,
    openGraph: { title, description, images: [image], type: 'profile' },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function PetPage({ params }: Props) {
  const { id } = await params;
  const c = await loadCard(id).catch(() => null);
  if (!c) notFound();
  const tone = c.returnPct === null || c.returnPct === 0 ? undefined : c.returnPct > 0 ? 'var(--up)' : 'var(--down)';
  const when = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-4 pb-24 pt-[max(12px,env(safe-area-inset-top))]">
      <p className="text-center text-[12px] num" style={{ color: 'var(--muted)' }}>
        {c.execution === 'demo' ? 'trades on Bitget’s demo exchange' : 'paper-traded at the bar close'}
      </p>
      <div className="mx-auto mt-2 grid h-64 w-64 place-items-center">
        <img src={familyImage(c.family, c.mood)} alt={`${c.name}, a ${c.species.toLowerCase()}, looking ${c.mood}`} className="h-64 w-64 object-contain" />
      </div>
      <h1 className="text-center text-[34px] font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{c.name}</h1>
      <p className="text-center text-[14px]" style={{ color: 'var(--muted)' }}>
        {c.species} · {c.ticker} ({c.company}) · {PERSONALITY_NAME[c.personality]}
      </p>

      <div className="card mt-4 px-4 py-3">
        <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>Return{c.since ? ` since ${when(c.since).split(',')[0]}` : ''}</p>
        <p className="text-[30px] font-bold num leading-tight" style={{ color: tone }}>{c.returnPct === null ? 'Just hatched' : pct(c.returnPct)}</p>
        <p className="mt-1 text-[12.5px] num" style={{ color: 'var(--muted)' }}>
          {[c.sharpe !== null ? `Sharpe ${c.sharpe.toFixed(2)}` : null, c.maxDrawdownPct !== null ? `max DD ${c.maxDrawdownPct.toFixed(1)}%` : null, `${c.closes} closes`, c.faints ? `fainted ${c.faints}×` : null].filter(Boolean).join(' · ')}
        </p>
      </div>

      {c.pinky && <PromiseCard pinky={c.pinky} price={null} now={Date.now()} />}

      <section className="mt-5">
        <h2 className="text-[17px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>From its diary</h2>
        <ul className="mt-2 grid gap-2">
          {c.recent.map((e) => (
            <li key={`${e.ts}-${e.kind}`} className="card px-4 py-2.5">
              <p className="text-[13.5px] leading-snug">{e.text}</p>
              <p className="mt-1 text-[11px] num" style={{ color: 'var(--muted)' }}>{e.kind} · {when(e.ts)} UTC</p>
            </li>
          ))}
          {!c.recent.length && <li className="text-[13px]" style={{ color: 'var(--muted)' }}>Nothing yet — it has only just hatched.</li>}
        </ul>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link href="/adopt" className="pill grid place-items-center text-[16px]">Adopt your own</Link>
        <Link href="/proof" className="grid h-14 place-items-center rounded-full border text-[15px] font-semibold" style={{ borderColor: 'var(--ink)', fontFamily: 'var(--font-display)' }}>Check the proof</Link>
      </div>
      <Nav />
    </main>
  );
}
