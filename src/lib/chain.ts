import { createHash } from 'node:crypto';
import { preimage, type ChainRow } from './chain-core';

// The diary as a hash chain.
//
// Every row the worker writes carries sha256(previous hash + this row, canonically serialised), per
// pet, starting from "genesis:<pet id>". Change, drop or reorder any row and every hash after it
// stops matching, so a log that verifies is a log nobody has edited since it was written. The chain
// follows prev_hash links rather than row ids, because a row the browser synced first can hold an
// older id than the worker's rows around it.
//
// The canonical form lives in ./chain-core so the writer (lib/tick.ts), the Node verifier
// (scripts/verify.ts) and the Proof page's in-browser check all hash exactly the same bytes.

export { canonical, genesis, stable, type ChainRow } from './chain-core';

export const link = (prev: string, row: ChainRow) => createHash('sha256').update(preimage(prev, row)).digest('hex');
