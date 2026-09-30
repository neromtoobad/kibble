import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card } from './card';
import type { Personality } from './pet-math';

// The share card's picture, apart from where its numbers come from, so it can be rendered and
// looked at without a database. 1200×630, the size X and everyone else unfurl. The app's own
// faces — Fredoka for display, Nunito for text — come from Fontsource as .woff, which the renderer
// reads (it cannot read the .woff2 next/font serves the pages).

export const PERSONALITY_NAME: Record<Personality, string> = {
  diamond: 'Diamond Hands', degen: 'Degen', boomer: 'Boomer', quant: 'Quant', owl: 'Night Shift',
};

const C = { canvas: '#F6F5EE', surface: '#FFFFFF', ink: '#111111', muted: '#6B6F66', line: '#E4E3DA', accent: '#C8FF3D', up: '#178F62', down: '#D6403F' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
/** Shorten to at most n characters, at a word boundary, with an ellipsis. */
const clip = (s: string, n: number) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > n * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
};

let fonts: Promise<Array<{ name: string; data: Buffer; weight: 600 | 700; style: 'normal' }>> | null = null;
const loadFonts = () => (fonts ??= Promise.all(
  ([['Fredoka', 'fredoka', 700], ['Nunito', 'nunito', 600], ['Nunito', 'nunito', 700]] as const).map(async ([name, pkg, weight]) => ({
    name, weight, style: 'normal' as const,
    data: await readFile(join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', `${pkg}-latin-${weight}-normal.woff`)),
  })),
));

export async function cardImage(card: Card, art: Buffer | null): Promise<ImageResponse> {
  const src = art ? `data:image/png;base64,${art.toString('base64')}` : null;
  const r = card.returnPct;
  const tone = r === null || r === 0 ? C.ink : r > 0 ? C.up : C.down;
  const stats = [
    card.since ? `since ${day(card.since)}` : null,
    card.sharpe !== null ? `Sharpe ${card.sharpe.toFixed(2)}` : null,
    card.maxDrawdownPct !== null ? `max DD ${card.maxDrawdownPct.toFixed(1)}%` : null,
    `${card.closes} closes`,
    card.faints ? `fainted ${card.faints}×` : null,
  ].filter(Boolean).join('  ·  ');
  const box = { display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 24, background: C.surface, border: `2px solid ${C.line}`, borderRadius: 28, padding: '16px 24px' } as const;
  const label = { display: 'flex', fontFamily: 'Nunito', fontWeight: 700, fontSize: 18, letterSpacing: 1.5, color: C.muted } as const;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.canvas, padding: 40, fontFamily: 'Nunito', fontWeight: 600, color: C.ink }}>
        <div style={{ width: 470, height: 550, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface, borderRadius: 40, border: `2px solid ${C.line}` }}>
          {src && <img src={src} width={430} height={430} style={{ objectFit: 'contain' }} />}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: 44, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: C.accent, borderRadius: 999, padding: '6px 18px', fontFamily: 'Fredoka', fontWeight: 700, fontSize: 24 }}>Kibble</div>
            <div style={{ display: 'flex', marginLeft: 14, fontSize: 20, color: C.muted }}>an AI pet that trades a Bitget stock perpetual</div>
          </div>
          <div style={{ display: 'flex', flexShrink: 0, fontFamily: 'Fredoka', fontWeight: 700, fontSize: 70, lineHeight: 1.1, marginTop: 18 }}>{clip(card.name, 16)}</div>
          <div style={{ display: 'flex', flexShrink: 0, fontSize: 25, color: C.muted, marginTop: 2 }}>
            {`${card.species} · ${card.ticker} perpetual · ${PERSONALITY_NAME[card.personality]}`}
          </div>
          <div style={{ display: 'flex', flexShrink: 0, fontFamily: 'Fredoka', fontWeight: 700, fontSize: 88, lineHeight: 1.1, color: tone, marginTop: 14 }}>
            {r === null ? 'Just hatched' : `${r > 0 ? '+' : ''}${r.toFixed(2)}%`}
          </div>
          <div style={{ display: 'flex', flexShrink: 0, fontSize: 21, color: C.muted, marginTop: 2 }}>{stats}</div>
          {card.pinky ? (
            <div style={box}>
              <div style={label}>{`PINKY PROMISE${card.pinky.hit ? ' · TARGET REACHED' : ''}`}</div>
              <div style={{ display: 'flex', fontFamily: 'Nunito', fontWeight: 700, fontSize: 24, lineHeight: 1.3, marginTop: 4 }}>{`“${clip(card.pinky.thesis, 105)}”`}</div>
              <div style={{ display: 'flex', fontSize: 20, color: C.muted, marginTop: 6 }}>
                {`right at $${card.pinky.target.toFixed(2)}  ·  wrong at $${card.pinky.stop.toFixed(2)}  ·  by ${day(card.pinky.until)}`}
              </div>
            </div>
          ) : card.recent[0] ? (
            <div style={box}>
              <div style={label}>FROM ITS DIARY</div>
              <div style={{ display: 'flex', fontSize: 23, lineHeight: 1.35, marginTop: 4 }}>{`“${clip(card.recent[0].text, 140)}”`}</div>
            </div>
          ) : null}
          <div style={{ display: 'flex', flexShrink: 0, marginTop: 'auto', fontSize: 18, color: C.muted }}>
            {`${card.execution === 'demo' ? 'Trades on Bitget’s demo exchange' : 'Paper-traded at the bar close'}  ·  every decision hash-chained`}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await loadFonts(), headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  );
}
