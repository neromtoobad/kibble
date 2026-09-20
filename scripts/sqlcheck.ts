/**
 * Every column named in SQL has to exist in the schema.
 *
 * This is here because it did not, once: the perpetual migration renamed the pet's money from
 * `cash`/`lots`/`lent_qty` to `margin`/`position`/`marks`, and the sync route kept writing the old
 * names. Postgres raised, the caller swallowed it to keep the app alive offline, and the result was
 * an app that looked healthy while nothing ever reached the database — no board, and no pets for
 * the hourly worker to tick. A silent write path is the worst kind to get wrong, so it is checked.
 *
 * Static, so it needs no database and runs in CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const schemaSrc = readFileSync('src/lib/pg.ts', 'utf8');

// ── what the schema actually defines ───────────────────────────────────────────
const tables = new Map<string, Set<string>>();

for (const m of schemaSrc.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
  const cols = new Set<string>();
  for (const line of m[2].split('\n')) {
    const c = line.trim().match(/^(\w+)\s+\w/);
    if (c && !/^(primary|unique|foreign|constraint|check)$/i.test(c[1])) cols.add(c[1]);
  }
  tables.set(m[1], cols);
}
// Columns bolted on after the first deploy.
for (const m of schemaSrc.matchAll(/alter table (\w+) add column if not exists (\w+)/g)) {
  tables.get(m[1])?.add(m[2]);
}

// ── every SQL statement in the app ─────────────────────────────────────────────
const files: string[] = [];
(function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts') && !p.endsWith('pg.ts') && !p.endsWith('sqlcheck.ts')) files.push(p);
  }
})('src');
files.push('scripts/worker.ts');

const problems: string[] = [];
const seen = { insert: 0, update: 0, select: 0 };

const check = (file: string, table: string, col: string, what: string) => {
  const known = tables.get(table);
  if (!known) return problems.push(`${file}: unknown table "${table}"`);
  if (!known.has(col)) problems.push(`${file}: ${what} names "${col}", which ${table} does not have`);
};

for (const file of files) {
  const src = readFileSync(file, 'utf8');

  // insert into <table> (a, b, c)
  for (const m of src.matchAll(/insert into (\w+)\s*\(([^)]*)\)/gi)) {
    seen.insert++;
    for (const col of m[2].split(',').map((c) => c.trim()).filter(Boolean)) {
      check(file, m[1], col, `insert into ${m[1]}`);
    }
  }

  // update <table> set a=..., b=...
  for (const m of src.matchAll(/update (\w+) set ([\s\S]*?)\n\s*(?:where|returning)/gi)) {
    seen.update++;
    for (const a of m[2].matchAll(/(\w+)\s*=/g)) check(file, m[1], a[1], `update ${m[1]}`);
  }

  // select a, b from <table> [alias] [join <table> [alias] ...]
  //
  // Aliases have to be resolved rather than skipped: the paper-log export joins pet_entries to
  // pets and selects p.marks, which is correct and which an alias-blind check calls a bug. A
  // checker that cries wolf on correct SQL gets switched off, so it earns its keep by
  // understanding the join. Anything with an expression or a star is still left to the database.
  for (const m of src.matchAll(/select ([\s\S]*?)\s+from\s+(\w+)(?:\s+(?!where|order|group|limit|join|on|left|inner|right)(\w+))?((?:\s+(?:left |inner |right )?join\s+\w+(?:\s+\w+)?\s+on[\s\S]*?)*?)(?=\s+where|\s+order|\s+group|\s+limit|\s*`|$)/gi)) {
    const [, list, primary, primaryAlias, joins] = m;
    if (/[*()]|\bas\b/i.test(list) || !tables.has(primary)) continue;

    // alias → table, for the primary and every joined table
    const alias = new Map<string, string>([[primary, primary]]);
    if (primaryAlias) alias.set(primaryAlias, primary);
    for (const j of (joins ?? '').matchAll(/join\s+(\w+)(?:\s+(\w+))?\s+on/gi)) {
      alias.set(j[1], j[1]);
      if (j[2]) alias.set(j[2], j[1]);
    }

    seen.select++;
    for (const raw of list.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)) {
      if (/^\d+$/.test(raw)) continue; // select 1 from … — an existence probe
      const dot = raw.indexOf('.');
      if (dot < 0) { check(file, primary, raw, `select from ${primary}`); continue; }
      const table = alias.get(raw.slice(0, dot));
      if (!table) { problems.push(`${file}: "${raw}" uses an alias that is not in the FROM clause`); continue; }
      check(file, table, raw.slice(dot + 1), `select from ${table}`);
    }
  }
}

for (const [t, cols] of tables) console.log(`${t}: ${cols.size} columns`);
console.log(`checked ${seen.insert} inserts, ${seen.update} updates, ${seen.select} selects across ${files.length} files\n`);

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('✓ every column named in SQL exists in the schema');
