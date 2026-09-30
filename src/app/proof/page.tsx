'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { genesis, preimage, type ChainRow } from '@/lib/chain-core';

// Proof: everything this agent claims, in a form a judge can check in a couple of minutes. Every
// number here is fetched from a public route and computed from the agent's own diary — nothing is
// typed in — and the hash chain is re-verified in the reader's own browser, not taken on trust.

type Agent = {
  agent: string; instrument: string; personality: string; return_pct: number | null; sharpe: number | null;
  max_drawdown_pct: number | null; win_rate: number | null; closes: number; trades: number; decisions: number; vetoed_or_clamped: number;
};
type Metrics = { totals: Record<string, number>; agents: Agent[] };
type Intervention = { ts: number; by: string; kind: string; text: string; qty: number; price: number; later: number; pending: boolean; saved: number; funding: number };
type Twin = { since: string; startEquity: number; live: { returnPct: number; sharpe: number | null; maxDrawdownPct: number | null }; twin: { returnPct: number; sharpe: number | null; maxDrawdownPct: number | null; trades: number }; addedPct: number };
type ProofAgent = { agent: string; instrument: string; personality: string; guardian: null | { interventions: number; settled: number; saved: number; helped: number; hurt: number; byLayer: Record<string, { count: number; saved: number }>; recent: Intervention[] }; twin: Twin | null };
type Proof = { note: string; totals: { interventions: number; settled: number; saved: number; helped: number; hurt: number; twinAddedPctAvg: number | null }; agents: ProofAgent[] };
type Kennel = { pets: string[]; halted: boolean; status: null | { breaker: string; equity: number; dayChangePct: number | null; drawdownPct: number; exposure: number; reason: string | null } };
type ChainPet = { petId: string; name: string; length: number; head: string | null; orphans: number; rows: Array<Omit<ChainRow, 'petId'> & { hash: string; prev: string }> };
type LogRow = { timestamp: string; agent: string; action: string; direction: string | null; price: number | null; quantity: number | null; execution: string; order_id: string | null; fill_price: number | null; by: string | null; meta?: Record<string, unknown>; note: string };

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const pct = (v: number | null | undefined, dp = 2) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(dp)}%`);
const tone = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? undefined : v > 0 ? 'var(--up)' : 'var(--down)');
const when = (t: number | string) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const get = <T,>(url: string): Promise<T | null> => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Walk every pet's chain from genesis and recompute each link — in this browser, from the public rows. */
async function verifyChains(pets: ChainPet[]) {
  const out: Array<{ name: string; rows: number; ok: boolean; brokeAt: number | null; head: string | null }> = [];
  for (const p of pets) {
    let prev = genesis(p.petId), brokeAt: number | null = null;
    for (const [i, r] of p.rows.entries()) {
      const want = await sha256(preimage(prev, { ...r, petId: p.petId }));
      if (r.prev !== prev || r.hash !== want) { brokeAt = i + 1; break; }
      prev = r.hash;
    }
    out.push({ name: p.name, rows: p.rows.length, ok: brokeAt === null, brokeAt, head: p.head });
  }
  return out;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[20px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
      {sub && <p className="mt-1 max-w-[720px] text-[13.5px]" style={{ color: 'var(--muted)' }}>{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ v, k, color }: { v: React.ReactNode; k: string; color?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="num text-[22px] font-bold" style={{ color }}>{v}</p>
      <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{k}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-[11.5px] font-semibold" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : undefined }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function ProofPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [kennels, setKennels] = useState<Kennel[] | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [chain, setChain] = useState<Awaited<ReturnType<typeof verifyChains>> | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let alive = true;
    get<Metrics>('/api/metrics').then((m) => alive && setMetrics(m));
    get<Proof>('/api/proof').then((p) => alive && setProof(p));
    get<{ kennels: Kennel[] }>('/api/kennel').then((k) => alive && setKennels(k?.kennels ?? []));
    get<{ log: LogRow[] }>('/api/log?full=1').then((l) => alive && setLog(l?.log ?? []));
    return () => { alive = false; };
  }, []);

  const runVerify = async () => {
    setVerifying(true);
    const c = await get<{ pets: ChainPet[] }>('/api/chain');
    setChain(c ? await verifyChains(c.pets) : []);
    setVerifying(false);
  };

  // The inspector: each model decision with what it read before it, and what the mandate and the
  // exchange did after it.
  const decisions = (log ?? []).map((r, i) => ({ r, i })).filter(({ r }) => r.action === 'decided').slice(-12).reverse().map(({ r, i }) => {
    const all = log ?? [];
    const t = Date.parse(r.timestamp);
    const sensed = [...all.slice(0, i)].reverse().find((x) => x.agent === r.agent && x.action === 'sensed' && Math.abs(Date.parse(x.timestamp) - t) < 3 * 3600e3);
    const after = all.filter((x) => x.agent === r.agent && x.timestamp === r.timestamp && x.action !== 'decided');
    return { r, sensed, after };
  });

  const t = metrics?.totals;
  const g = proof?.totals;

  return (
    <main className="mx-auto min-h-dvh max-w-[980px] px-4 pb-28 pt-[max(16px,env(safe-area-inset-top))]">
      <h1 className="text-[30px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>Proof</h1>
      <p className="max-w-[720px] text-[14px]" style={{ color: 'var(--muted)' }}>
        Everything Kibble claims, checkable in a couple of minutes. Every number is computed from the agents&apos; own diary and the real
        Bitget tape by a public route — nothing here is typed in — and the diary&apos;s hash chain is verified by your browser, not taken on trust.
      </p>

      <Section title="The score" sub="Paper trading since 20 Sep. Three agents execute on Bitget's demo exchange; two trade contracts demo does not list and are simulated at the bar close.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat v={t?.agents ?? '—'} k="agents" />
          <Stat v={t?.trades ?? '—'} k="trades" />
          <Stat v={t?.decisions ?? '—'} k="model decisions" />
          <Stat v={t ? `${t.vetoed_or_clamped}${t.decisions ? ` · ${Math.round((t.vetoed_or_clamped / t.decisions) * 100)}%` : ''}` : '—'} k="vetoed or clamped by the mandate" />
        </div>
        <div className="mt-3">
          <Table head={['Agent', 'Contract', 'Mandate', 'Return', 'Sharpe', 'Max DD', 'Win rate', 'Closes']}
            rows={(metrics?.agents ?? []).map((a) => [a.agent, <span key="i" className="num">{a.instrument}</span>, a.personality,
              <span key="r" className="num" style={{ color: tone(a.return_pct) }}>{pct(a.return_pct)}</span>,
              <span key="s" className="num">{a.sharpe ?? '—'}</span>, <span key="d" className="num">{a.max_drawdown_pct ?? '—'}%</span>,
              <span key="w" className="num">{a.win_rate === null ? '—' : `${Math.round(a.win_rate * 100)}%`}</span>, <span key="c" className="num">{a.closes}</span>])} />
        </div>
      </Section>

      <Section title="What the risk layer was worth"
        sub="Every time a risk layer overruled a pet — cut a position, or refused or shrank a buy — the trade that did not happen is marked to market 24 hours later, funding included. Saved is what ignoring it would have lost. It is allowed to come out negative, and sometimes does.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat v={g ? money(g.saved) : '—'} k="saved, settled interventions" color={tone(g?.saved)} />
          <Stat v={g ? `${g.helped} / ${g.hurt}` : '—'} k="helped / hurt" />
          <Stat v={g?.interventions ?? '—'} k="interventions" />
          <Stat v={g?.twinAddedPctAvg == null ? '—' : pct(g.twinAddedPctAvg)} k="model vs its fixed-rule twin, avg" color={tone(g?.twinAddedPctAvg)} />
        </div>
        <div className="mt-3">
          <Table head={['When', 'Agent', 'Layer', 'What it did', 'Price → 24h later', 'Saved']}
            rows={(proof?.agents ?? []).flatMap((a) => (a.guardian?.recent ?? []).map((x) => ({ a, x }))).sort((p, q) => q.x.ts - p.x.ts).slice(0, 12)
              .map(({ a, x }) => [<span key="w" className="num">{when(x.ts)}</span>, a.agent, x.by, <span key="t" className="text-[12.5px]">{x.text}</span>,
                <span key="p" className="num">{x.price.toFixed(2)} → {x.later.toFixed(2)}{x.pending ? ' (so far)' : ''}</span>,
                <span key="s" className="num" style={{ color: tone(x.saved) }}>{money(x.saved)}</span>])} />
        </div>
      </Section>

      <Section title="The model against its own fixed-rule twin"
        sub="Each pet replayed on its personality's fixed rules alone — same stock, starting equity and bars — from its first hourly mark. The gap is what the model's judgement added. The live pets ran older code in their first days, so this compares them with today's rules.">
        <Table head={['Agent', 'Live return', 'Twin return', 'Added', 'Live max DD', 'Twin max DD', 'Since']}
          rows={(proof?.agents ?? []).filter((a) => a.twin).map((a) => [a.agent,
            <span key="l" className="num" style={{ color: tone(a.twin!.live.returnPct) }}>{pct(a.twin!.live.returnPct)}</span>,
            <span key="t" className="num" style={{ color: tone(a.twin!.twin.returnPct) }}>{pct(a.twin!.twin.returnPct)}</span>,
            <span key="a" className="num" style={{ color: tone(a.twin!.addedPct) }}>{pct(a.twin!.addedPct)} pts</span>,
            <span key="ld" className="num">{a.twin!.live.maxDrawdownPct?.toFixed(1) ?? '—'}%</span>,
            <span key="td" className="num">{a.twin!.twin.maxDrawdownPct?.toFixed(1) ?? '—'}%</span>,
            <span key="s" className="num">{a.twin!.since.slice(0, 10)}</span>])} />
      </Section>

      <Section title="The kennel breaker" sub="Each owner's pets together: 3% down on the day stops new risk until tomorrow; 8% below the high-water mark cuts every pet to 1× for up to 24 hours; total exposure is capped at 3× equity; and the owner can pull a kill switch.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(kennels ?? []).map((k, i) => (
            <div key={i} className="card px-4 py-3 text-[13px]">
              <p className="font-semibold">{k.pets.join(', ')} <span className="num ml-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--canvas)', color: k.status?.breaker === 'armed' ? 'var(--up)' : 'var(--down)' }}>{k.halted ? 'halted' : k.status?.breaker ?? '—'}</span></p>
              <p className="num mt-1" style={{ color: 'var(--muted)' }}>equity ${k.status?.equity.toFixed(2)} · today {pct(k.status?.dayChangePct)} · drawdown {k.status?.drawdownPct.toFixed(2)}% · exposure {k.status?.exposure.toFixed(2)}×</p>
              {k.status?.reason && <p className="mt-1 text-[12.5px]">{k.status.reason}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="The diary is a hash chain" sub="Every row the worker writes carries sha256 of the previous row's hash and itself. Edit, drop or reorder one and every link after it fails. This button fetches the public rows and recomputes every link here, in your browser.">
        <button onClick={runVerify} disabled={verifying} className="pill px-5 py-2.5 text-[15px] font-bold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
          {verifying ? 'Verifying…' : chain ? 'Verify again' : 'Verify the chain in this browser'}
        </button>
        {chain && (
          <ul className="mt-3 grid gap-1.5 text-[13.5px]">
            {chain.length === 0 && <li style={{ color: 'var(--muted)' }}>No chained rows yet — the chain starts with the first write after 30 Sep 08:30 UTC.</li>}
            {chain.map((c) => (
              <li key={c.name} className="num">{c.ok ? '✓' : '✗'} {c.name}: {c.rows} rows{c.ok ? `, head ${c.head?.slice(0, 16)}…` : ` — breaks at row ${c.brokeAt}`}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>Or from a terminal: <span className="num">npm run verify</span>. The mirror at neromtoobad.github.io/kibble keeps an hourly copy.</p>
      </Section>

      <Section title="Why did it do that?" sub="The last model decisions: what the pet read, what it chose and how sure it was, what its mandate did about it, and what the exchange filled.">
        <div className="grid gap-2">
          {decisions.map(({ r, sensed, after }, i) => {
            const m = (r.meta ?? {}) as { model?: string; confidence?: number; cited?: string[] };
            return (
              <details key={i} className="card px-4 py-3">
                <summary className="cursor-pointer text-[14px]">
                  <span className="font-semibold">{r.agent}</span> <span style={{ color: 'var(--muted)' }}>· {when(r.timestamp)} ·</span> {r.note.replace(/^Read .*? and decided: /, '').slice(0, 110)}{r.note.length > 110 ? '…' : ''}
                </summary>
                <div className="mt-2 grid gap-2 text-[13px]">
                  {sensed && <p><b>Read:</b> {sensed.note.replace(/^Read \d+ new items?: /, '')}</p>}
                  <p><b>Decided:</b> {r.note}</p>
                  <p className="num" style={{ color: 'var(--muted)' }}>{m.model ?? 'model not recorded'}{m.confidence != null ? ` · ${Math.round(m.confidence * 100)}% sure` : ''}{m.cited?.length ? ` · cited ${m.cited.length}` : ''}</p>
                  {after.map((x, j) => (
                    <p key={j}><b>{x.action === 'vetoed' ? 'Mandate:' : `${x.direction ?? x.action}:`}</b> {x.note}
                      {x.order_id && <span className="num" style={{ color: 'var(--muted)' }}> · Bitget order {x.order_id}{x.fill_price ? ` filled at ${x.fill_price.toFixed(2)}` : ''}</span>}</p>
                  ))}
                </div>
              </details>
            );
          })}
          {log && decisions.length === 0 && <p style={{ color: 'var(--muted)' }}>No model decisions in the log yet.</p>}
        </div>
      </Section>

      <Section title="The raw material">
        <p className="num text-[13px] leading-7">
          <a href="/api/log">/api/log</a> · <a href="/api/log?full=1">/api/log?full=1</a> · <a href="/api/log?format=csv">csv</a> · <a href="/api/metrics">/api/metrics</a> · <a href="/api/proof">/api/proof</a> · <a href="/api/kennel">/api/kennel</a> · <a href="/api/chain">/api/chain</a> · <a href="https://neromtoobad.github.io/kibble/">mirror</a> · <a href="https://github.com/neromtoobad/kibble">source</a>
        </p>
      </Section>
      <Nav />
    </main>
  );
}
