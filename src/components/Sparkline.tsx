'use client';

/**
 * The pet's equity over the last stretch — its own hourly marks, the same series the
 * engine scored for Sharpe and drawdown. Nothing is reconstructed here.
 */
export function Sparkline({ marks, width = 120, height = 34 }: {
  marks: Array<[number, number]>; width?: number; height?: number;
}) {
  if (!marks || marks.length < 2) return null;
  const series = marks.slice(-120).map(([, eq]) => eq);
  const lo = Math.min(...series), hi = Math.max(...series);
  const span = hi - lo || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * width, height - ((v - lo) / span) * (height - 4) - 2]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = series.at(-1)! >= series[0];
  const stroke = up ? 'var(--up)' : 'var(--down)';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Equity trend" className="overflow-visible">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={stroke} opacity="0.12" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill={stroke} />
    </svg>
  );
}
