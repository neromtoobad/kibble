import { NextResponse } from 'next/server';
import { dbEnabled, ensureSchema, pool } from '@/lib/db';
import { metrics } from '@/lib/metrics';
import { SPECIES, type Species } from '@/lib/pets';
import type { Entry, EntryKind, PetState, Personality, Position } from '@/lib/pet-math';

// The numbers the track scores — Sharpe, max drawdown, win rate — for every agent, computed live
// by metrics.ts from the same hourly equity marks and diary the engine writes. Nothing here is
// typed in; refresh it and it moves. Public and read-only, like /api/log.

export const dynamic = 'force-dynamic';

type PetRow = {
  id: string; name: string; species: string; personality: Personality; adopted_at: Date;
  margin: string; position: Position; realized: string; funding_paid: string; faints: number;
  marks: Array<[number, number]> | null;
};
type EntryRow = { pet_id: string; ts: Date; kind: EntryKind; qty: string | null; price: string | null; usd: string | null };

const n = (v: string | null) => (v === null ? undefined : Number(v));
const round = (v: number | null, dp = 2) => (v === null || !Number.isFinite(v) ? null : Number(v.toFixed(dp)));

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ error: 'no database configured' }, { status: 503 });

  try {
    await ensureSchema();
    const pets = await pool().query<PetRow>(
      `select id, name, species, personality, adopted_at, margin, position, realized, funding_paid, faints, marks
         from pets order by adopted_at asc`,
    );
    const entries = await pool().query<EntryRow>(
      `select pet_id, ts, kind, qty, price, usd
         from pet_entries order by ts asc`,
    );
    const diary = new Map<string, Entry[]>();
    for (const e of entries.rows) {
      const list = diary.get(e.pet_id) ?? [];
      list.push({ ts: e.ts.getTime(), kind: e.kind, text: '', qty: n(e.qty), price: n(e.price), usd: n(e.usd) });
      diary.set(e.pet_id, list);
    }

    const agents = pets.rows.map((r) => {
      const marks = r.marks ?? [];
      const pet = {
        species: r.species, name: r.name, personality: r.personality, marks,
        realized: Number(r.realized), fundingPaid: Number(r.funding_paid), faints: r.faints ?? 0,
        diary: diary.get(r.id) ?? [],
      } as unknown as PetState;
      const equityNow = marks.at(-1)?.[1] ?? Number(r.margin);
      const m = metrics(pet, equityNow);
      const start = marks[0]?.[1] ?? null;
      const a = m.actions;
      return {
        agent: r.name,
        instrument: SPECIES[r.species as Species['id']]?.symbol ?? r.species,
        personality: r.personality,
        since: marks[0] ? new Date(marks[0][0]).toISOString() : null,
        hours_marked: marks.length,
        equity: round(equityNow),
        return_pct: start ? round(((equityNow - start) / start) * 100) : null,
        sharpe: round(m.sharpe),
        max_drawdown_pct: round(m.maxDrawdownPct),
        win_rate: round(m.winRate, 3),
        closes: m.trades,
        trades: (a.open ?? 0) + (a.add ?? 0) + (a.trim ?? 0) + (a.flatten ?? 0) + (a.liquidated ?? 0),
        decisions: a.decided ?? 0,
        vetoed_or_clamped: a.vetoed ?? 0,
        held_for_owner: a.ask ?? 0,
        funding_payments: a.funding ?? 0,
        funding_paid: round(m.fundingPaid, 4),
        fees: round(m.fees, 4),
        faints: m.faints,
      };
    });

    const sum = (k: 'trades' | 'decisions' | 'vetoed_or_clamped' | 'funding_payments' | 'faints' | 'closes') =>
      agents.reduce((s, x) => s + x[k], 0);
    return NextResponse.json({
      note: 'Computed live by src/lib/metrics.ts from each agent\'s hourly equity marks (Sharpe, annualised; max drawdown) and its diary (win rate over closing trades). Paper trading.',
      as_of: new Date().toISOString(),
      totals: {
        agents: agents.length,
        trades: sum('trades'), closes: sum('closes'), decisions: sum('decisions'),
        vetoed_or_clamped: sum('vetoed_or_clamped'), funding_payments: sum('funding_payments'), faints: sum('faints'),
      },
      agents,
    }, { headers: { 'Cache-Control': 's-maxage=60' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
