'use client';
import type { Pinky } from '@/lib/pet-math';

// The pet's open pinky promise: what it said, and where the price sits right now between the stop
// that would prove it wrong and the target that would prove it right.

const left = (ms: number) => {
  if (ms <= 0) return 'due now';
  const h = Math.round(ms / 3600e3);
  return h >= 48 ? `${Math.round(h / 24)} days left` : `${Math.max(1, h)}h left`;
};

export function PromiseCard({ pinky, price, now }: { pinky: Pinky; price: number | null; now: number | null }) {
  const lo = pinky.stop, hi = pinky.target;
  const pos = (p: number) => `${Math.min(100, Math.max(0, ((p - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="card mt-2 px-4 py-3">
      <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
        <span aria-hidden>🤙</span> Pinky promise{pinky.hit ? ' · target reached, stop at entry' : ''}
      </p>
      <p className="mt-0.5 text-[14.5px] font-semibold leading-snug" style={{ fontFamily: 'var(--font-display)' }}>&ldquo;{pinky.thesis}&rdquo;</p>
      <div className="relative mb-1 mt-3.5 h-2 rounded-full" role="img"
        aria-label={`Price ${price?.toFixed(2) ?? 'unknown'}, stop ${lo.toFixed(2)}, target ${hi.toFixed(2)}`}
        style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--down) 45%, var(--canvas)), var(--canvas) 50%, color-mix(in srgb, var(--up) 45%, var(--canvas)))' }}>
        <span className="absolute top-1/2 h-3.5 w-px -translate-y-1/2" style={{ left: pos(pinky.entry), background: 'var(--muted)' }} title={`made at $${pinky.entry.toFixed(2)}`} />
        {price !== null && (
          <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: pos(price), background: 'var(--accent)', borderColor: 'var(--ink)' }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] num" style={{ color: 'var(--muted)' }}>
        <span>wrong at ${lo.toFixed(2)}</span>
        {now !== null && <span>{left(pinky.until - now)}</span>}
        <span>right at ${hi.toFixed(2)}</span>
      </div>
    </div>
  );
}
