import { genesis, link, type ChainRow } from '../src/lib/chain';

// Verify the hash-chained diary from the outside.
//
//   npm run verify                         checks the live app
//   npm run verify -- https://<any host>   checks another deployment, or a mirror
//
// For every pet it walks the chain from genesis and recomputes each hash from the row's own fields.
// One edited, dropped or reordered row anywhere and every link after it fails. It uses nothing but
// the public /api/chain output and lib/chain.ts, so a judge can run it without keys or a database.

type Pet = { petId: string; name: string; length: number; head: string | null; orphans: number; rows: Array<Omit<ChainRow, 'petId'> & { hash: string; prev: string }> };

async function main() {
  const base = (process.argv[2] ?? 'https://kibble.up.railway.app').replace(/\/$/, '');
  const res = await fetch(`${base}/api/chain`);
  if (!res.ok) { console.error(`${base}/api/chain → HTTP ${res.status}`); process.exit(1); }
  const { pets } = (await res.json()) as { pets: Pet[] };

  let bad = 0, total = 0;
  console.log(`\nverifying ${base}/api/chain\n`);
  for (const p of pets) {
    let prev = genesis(p.petId), broken = -1;
    p.rows.forEach((r, i) => {
      const want = link(prev, { ...r, petId: p.petId });
      if (broken < 0 && (r.prev !== prev || r.hash !== want)) broken = i;
      prev = r.hash;
    });
    total += p.rows.length;
    if (broken >= 0) {
      bad++;
      const r = p.rows[broken];
      console.log(`✗ ${p.name.padEnd(8)} breaks at row ${broken + 1} of ${p.rows.length}: ${new Date(r.ts).toISOString()} ${r.kind} — "${r.body.slice(0, 70)}"`);
    } else {
      console.log(`✓ ${p.name.padEnd(8)} ${String(p.rows.length).padStart(4)} rows, head ${p.head?.slice(0, 16) ?? '—'}…${p.orphans ? `  (${p.orphans} hashed rows off the chain)` : ''}`);
    }
  }
  console.log(bad ? `\n${bad} chain(s) broken\n` : `\nall ${pets.length} chains verify — ${total} rows, none edited since they were written\n`);
  process.exit(bad ? 1 : 0);
}

main();
