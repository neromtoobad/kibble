import { createHash } from 'node:crypto';

// The diary as a hash chain.
//
// Every row the worker writes carries sha256(previous hash + this row, canonically serialised), per
// pet, starting from "genesis:<pet id>". Change, drop or reorder any row and every hash after it
// stops matching, so a log that verifies is a log nobody has edited since it was written. The chain
// follows prev_hash links rather than row ids, because a row the browser synced first can hold an
// older id than the worker's rows around it.
//
// This file has no dependencies beyond node:crypto so that the verifier (scripts/verify.ts) and the
// writer (lib/tick.ts) cannot disagree about what a row is.

/** JSON with object keys sorted at every level — Postgres jsonb reorders keys, so a hash must not depend on order. */
export function stable(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? JSON.stringify(v) : 'null';
  return JSON.stringify(v);
}

export type ChainRow = {
  petId: string;
  ts: number;          // epoch ms
  kind: string;
  body: string;
  qty: number | null;
  price: number | null;
  usd: number | null;
  execution: string | null;
  orderId: string | null;
  fillPrice: number | null;
  by: string | null;
  meta: unknown;
};

/** Numbers pass through numeric columns and back; rounding to 12 significant digits makes the round trip exact. */
const num = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Number(v.toPrecision(12)));

export function canonical(r: ChainRow): string {
  return stable([
    r.petId, new Date(r.ts).toISOString(), r.kind, r.body,
    num(r.qty), num(r.price), num(r.usd), r.execution, r.orderId, num(r.fillPrice), r.by, r.meta ?? null,
  ]);
}

export const genesis = (petId: string) => `genesis:${petId}`;

export const link = (prev: string, row: ChainRow) => createHash('sha256').update(`${prev}\n${canonical(row)}`).digest('hex');
