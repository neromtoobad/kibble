import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import { SPECIES, type Species } from '@/lib/pets';

// The paper trading log, in the shape the hackathon asks for.
//
// The submission form is specific about what a Track 2 log must carry: "timestamp, instrument,
// direction, price, quantity, and account balance change". The diary is richer than that but
// shaped for reading, not for auditing, so this route projects it into those six columns and
// adds the ones that make a row checkable on its own — which pet, what it was reacting to, and
// whether its own risk layer had to step in.
//
// Public and unauthenticated on purpose: a judge has to be able to open it without an account,
// and it carries nothing private (no owner hashes, no keys).
//
//   /api/log            every executed trade, newest last, as JSON
//   /api/log?format=csv the same thing as a spreadsheet
//   /api/log?full=1     includes the sensed/decided/vetoed reasoning rows, not just executions
//
// "Direction" needs saying plainly: a Stockling only ever holds a long. So opening or adding is a
// BUY, and trimming, flattening or being liquidated is a SELL. There is no short side to report.

export const dynamic = 'force-dynamic';

const EXECUTIONS = ['open', 'add', 'trim', 'flatten', 'liquidated'];
const REASONING = ['sensed', 'decided', 'vetoed', 'ask', 'hold', 'funding'];

const DIRECTION: Record<string, string> = {
  open: 'BUY', add: 'BUY',
  trim: 'SELL', flatten: 'SELL', liquidated: 'SELL (forced)',
};

type Row = {
  ts: Date; kind: string; body: string;
  qty: string | null; price: string | null; usd: string | null; paper: boolean;
  name: string; species: string; marks: Array<[number, number]> | null;
};

export async function GET(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });

  const url = new URL(req.url);
  const full = url.searchParams.get('full') === '1';
  const kinds = full ? [...EXECUTIONS, ...REASONING] : EXECUTIONS;

  try {
    await ensureSchema();
    const { rows } = await pool().query<Row>(
      `select e.ts, e.kind, e.body, e.qty, e.price, e.usd, e.paper,
              p.name, p.species, p.marks
         from pet_entries e
         join pets p on p.id = e.pet_id
        where e.kind = any($1)
        order by e.ts asc
        limit 5000`,
      [kinds],
    );

    // Equity at the time of a row, from the engine's own hourly marks — the same series Sharpe
    // and drawdown are computed over, so the log and the metrics cannot disagree.
    const balanceAt = (marks: Array<[number, number]> | null, t: number): number | null => {
      if (!marks?.length) return null;
      let best: number | null = null;
      for (const [mt, eq] of marks) {
        if (mt <= t) best = eq;
        else break;
      }
      return best ?? marks[0][1];
    };

    const log = rows.map((r) => {
      const sp = SPECIES[r.species as Species['id']];
      const t = r.ts.getTime();
      return {
        timestamp: r.ts.toISOString(),
        agent: r.name,
        instrument: sp?.symbol ?? r.species,
        underlying: sp?.ticker ?? null,
        action: r.kind,
        direction: DIRECTION[r.kind] ?? null,
        price: r.price === null ? null : Number(r.price),
        quantity: r.qty === null ? null : Number(r.qty),
        // Cash effect of this row: realised PnL on a close, margin committed on an open,
        // the funding payment on a settlement. Negative means it left the account.
        balance_change: r.usd === null ? null : Number(r.usd),
        balance_after: balanceAt(r.marks, t),
        paper: r.paper,
        note: r.body,
      };
    });

    if (url.searchParams.get('format') === 'csv') {
      const cols = ['timestamp', 'agent', 'instrument', 'underlying', 'action', 'direction', 'price', 'quantity', 'balance_change', 'balance_after', 'paper', 'note'] as const;
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [cols.join(','), ...log.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="night-shift-paper-log.csv"',
        },
      });
    }

    const first = log[0]?.timestamp ?? null;
    const last = log[log.length - 1]?.timestamp ?? null;
    return NextResponse.json({
      note: 'Paper trading log. No order has been placed on any exchange. Every position is an isolated long on a Bitget rToken perpetual, so BUY opens or adds and SELL trims, flattens or is a liquidation.',
      rows: log.length,
      from: first,
      to: last,
      log,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
