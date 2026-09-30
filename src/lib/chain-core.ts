// The canonical form of a diary row, shared by the worker that writes the hash chain, the Node
// verifier, and the Proof page that re-verifies it in the reader's own browser. No imports, so it
// runs in all three and they cannot drift apart. See ./chain.ts for why the diary is a chain.

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

/** What gets hashed for a row: its predecessor's hash, a newline, and the row itself. */
export const preimage = (prev: string, row: ChainRow) => `${prev}\n${canonical(row)}`;
