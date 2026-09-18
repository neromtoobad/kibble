import sharp from 'sharp';
import { readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The character art comes out of the generator at ~900×1120 and 1.2MB a frame. The app draws the
// pet at 246 CSS px, so that is roughly thirteen times the pixels anyone sees, sixty times over —
// a slow first paint on the phone this is meant to be used on, and 22MB of repository nobody
// needs to clone.
//
// 592px keeps better than 2× for a retina screen at the size actually rendered. Palette PNG holds
// the alpha channel (the pet is composited over a themed canvas, so a white box would be
// obvious) and the art is flat-shaded enough that 256 colours costs nothing visible.
//
// Two different problems, so two different fixes. The six hero frames are oversized in pixels and
// get resized. The fifty-four mood frames are already 506×512 but were saved as full-colour PNG at
// a quarter-megabyte each, so they only need re-encoding.
//
// Idempotent by outcome rather than by rule: every frame is re-encoded and the result is kept only
// if it is actually smaller, so re-running is a no-op and dropping in a new frame fixes just that
// frame.

const TARGET_WIDTH = 592;
const ROOTS = ['public/pets'];

const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p.endsWith('.png')) files.push(p);
  }
}
for (const r of ROOTS) await walk(r);

let before = 0, after = 0, touched = 0;
for (const f of files) {
  const size = (await stat(f)).size;
  before += size;
  const meta = await sharp(f).metadata();

  let pipe = sharp(await readFile(f));
  if (meta.width > TARGET_WIDTH) pipe = pipe.resize({ width: TARGET_WIDTH });
  const out = await pipe.png({ compressionLevel: 9, palette: true }).toBuffer();

  // Keep it only if it genuinely wins; 2% guards against re-encoding churn.
  if (out.length >= size * 0.98) { after += size; continue; }
  await writeFile(f, out);
  after += out.length;
  touched++;
  const dim = meta.width > TARGET_WIDTH ? `${meta.width}px → ${TARGET_WIDTH}px` : `${meta.width}px`;
  console.log(`  ${f}  ${dim}  ${(size / 1024) | 0}KB → ${(out.length / 1024) | 0}KB`);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`\n${touched}/${files.length} rewritten · ${mb(before)}MB → ${mb(after)}MB (${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
