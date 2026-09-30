import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Brings generated character frames from art-src/<species>/ into public/pets/ on the same canvas,
// and at the same visual scale, as the original cast.
//
// The generator hands back 896×1120 with the character floating in wide margins, while the original
// frames are cropped tight: moods fill ~94% of a 506×512 canvas, heroes ~83% of 592×740, eggs ~72%
// of 409×512 (measured, not guessed). Resizing alone would draw a new pet visibly smaller than an
// old one in the same object-contain box, so each frame is trimmed to its content, scaled to that
// same share of the canvas and centred. Then palette PNG, as in optimize-art.mjs.
//
// art-src/ is the source of truth: every recognised frame is rewritten on each run. Frames that
// aren't there (the original six only have fainted.png in art-src) are left alone in public/.
// Leftovers such as hero-v1.png or hero-raw.png are ignored.

const MOODS = ['happy', 'ecstatic', 'chill', 'nervous', 'sulking', 'nightowl', 'pajamas', 'hungry', 'fainted'];
const FRAMES = {
  hero: { w: 592, h: 740, fill: 0.84 },
  mood: { w: 512, h: 512, fill: 0.92 },
  egg: { w: 409, h: 512, fill: 0.72 },
};

async function place(src, dst, { w, h, fill }) {
  const content = await sharp(src).trim({ threshold: 1 }).toBuffer();
  const fitted = await sharp(content)
    .resize(Math.round(w * fill), Math.round(h * fill), { fit: 'inside' })
    .toBuffer();
  const out = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await sharp(out).toFile(dst);
  return out.length;
}

let n = 0, bytes = 0;
for (const sp of (await readdir('art-src', { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const jobs = [
    ['hero', `public/pets/${sp}/hero.png`, FRAMES.hero],
    ...MOODS.map((m) => [m, `public/pets/${sp}/${m}.png`, FRAMES.mood]),
    ['egg', `public/pets/eggs/${sp}.png`, FRAMES.egg],
  ];
  const done = [];
  for (const [name, dst, frame] of jobs) {
    const src = join('art-src', sp, `${name}.png`);
    if (!existsSync(src)) continue;
    await mkdir(join(dst, '..'), { recursive: true });
    bytes += await place(src, dst, frame);
    done.push(name);
    n++;
  }
  if (done.length) console.log(`  ${sp.padEnd(8)} ${done.join(' ')}`);
}
console.log(`\n${n} frames → public/pets (${(bytes / 1024 / 1024).toFixed(1)}MB)`);
