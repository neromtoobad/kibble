import type { SensedEvent } from './feeds';
import { MANDATES, MIN_TICKET, fundingApr, type Intent } from './strategy';
import { SPECIES } from './pets';
import { leverage, liquidationDistance, type Personality, type PetState } from './pet-math';

// The pet's judgement. This is the half of the agent that is a model rather than a rule:
// it reads what happened, decides what to do about it, and says why in its own words.
//
// Two things it is deliberately NOT allowed to be:
//
//   1. The risk layer. The model proposes; `gate()` in ./strategy disposes. If it asks for
//      more leverage than the mandate allows, or to hold a carry the mandate refuses, the
//      gate overrides it and the override is written to the diary as a veto. A model that
//      could talk its way past its own risk limits would not be a risk limit.
//   2. Inside the engine. `judge()` runs BEFORE the engine and its result is passed in as an
//      input, exactly like bars and funding rates. That keeps the engine pure and the replay
//      deterministic: the same judgement and the same bars always produce the same actions,
//      so every line of the diary can be re-derived and explained after the fact.
//
// With no key configured this returns null and the pet falls back to its fixed-rule
// personality — which is also the baseline the model is measured against.

export type Judgement = {
  ts: number;
  intent: Intent;
  rationale: string;
  cited: string[];        // the event titles it says it used
  confidence: number;     // 0–1, the model's own
  model: string;
};

// Generous, because the failure this prevents looks exactly like a model that cannot produce
// JSON: a reasoning model spends tokens before it answers, gets cut off mid-object, and the
// parse fails on what was actually a perfectly good answer.
const MAX_TOKENS = 3000;
const CUT_OFF = `answer cut off at ${MAX_TOKENS} tokens`;

// One attempt may take this long; one judgement, however far down the chain it walks, may take
// the second. The worker judges five pets every fifteen minutes, so an unbounded walk through a
// chain of slow free models could overrun the next tick.
const ATTEMPT_MS = 40_000;
const BUDGET_MS = 120_000;

type Provider = { kind: 'anthropic' | 'openai'; key: string; models: string[]; url: string; openRouter: boolean };

/**
 * Free models churn. Two slugs that worked on Thursday were "unavailable for free" by Saturday,
 * and several others answer 429 depending on the hour. Pinning one name means the pet silently
 * stops thinking the moment its model is demoted, and the paper log grows a hole nobody notices
 * until a judge reads it.
 *
 * So KIBBLE_MODEL takes a comma-separated chain and the first model that actually answers
 * wins. These five were verified live against OpenRouter's free tier: a capable one first, a
 * finance-tuned one behind it, then progressively cheaper fallbacks. Whichever answered is
 * recorded on the judgement, so the diary always says which model made the call.
 */
const FREE_CHAIN = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'inclusionai/ling-3.0-flash-fin:free',
  'nex-agi/nex-n2.5-pro:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nex-agi/nex-n2.5-mini:free',
];

const chain = (raw: string | undefined, fallback: string[]) => {
  const picked = (raw ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return picked.length ? picked : fallback;
};

function provider(): Provider | null {
  const a = process.env.ANTHROPIC_API_KEY;
  if (a) return { kind: 'anthropic', key: a, models: chain(process.env.KIBBLE_MODEL, ['claude-opus-5']), url: 'https://api.anthropic.com/v1/messages', openRouter: false };
  // Anything OpenAI-compatible: OpenAI itself, OpenRouter
  // (https://openrouter.ai/api/v1), or Bitget's Qwen endpoint
  // (https://hackathon.bitgetops.com/v1) if those credits come through.
  const o = process.env.OPENAI_API_KEY;
  if (o) {
    const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    const openRouter = base.includes('openrouter.ai');
    return {
      kind: 'openai',
      key: o,
      models: chain(process.env.KIBBLE_MODEL, openRouter ? FREE_CHAIN : ['gpt-4o-mini']),
      url: `${base.replace(/\/$/, '')}/chat/completions`,
      openRouter,
    };
  }
  return null;
}

export const hasModel = () => provider() !== null;
export const modelName = () => provider()?.models[0] ?? null;
export const modelChain = () => provider()?.models ?? [];

// What the model is allowed to return. Kept narrow on purpose: these are the only five
// things a Stockling can do, and `size_usd` is a request, not a grant.
const SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['open', 'add', 'trim', 'flatten', 'hold'] },
    size_usd: { type: 'number', description: 'margin to commit for open/add; ignored otherwise' },
    fraction: { type: 'number', description: 'portion of the position to cut for trim, 0–1' },
    rationale: { type: 'string', description: "one or two sentences, in the pet's voice, naming what drove this" },
    cited: { type: 'array', items: { type: 'string' }, description: 'titles of the events you actually used' },
    confidence: { type: 'number', description: '0 to 1' },
  },
  required: ['action', 'rationale', 'cited', 'confidence'],
  additionalProperties: false,
} as const;

const VOICE: Record<Personality, string> = {
  diamond: 'Stubborn, dry, allergic to selling. You think in years.',
  degen: 'Manic, lowercase, impulsive, but you do respect a hard stop.',
  boomer: 'Formal, old-fashioned, faintly disapproving of everyone else.',
  quant: 'Precise, unemotional, speaks in costs and probabilities.',
  owl: 'Nocturnal, unhurried, quietly superior about working nights.',
};

function prompt(pet: PetState, price: number, fundingRate: number, events: SensedEvent[]) {
  const sp = SPECIES[pet.species];
  const m = MANDATES[pet.personality];
  const qty = pet.position?.qty ?? 0;
  const apr = fundingApr(fundingRate);

  // The numbers the gate itself uses. Given only contracts, entry and margin, a model works out
  // that $180 of exposure sits on $50 of margin, decides it is over its reserve, and trims a
  // position that was exactly at its limit — which is what Nova did, twice, at 95% confidence.
  const ceiling = Math.min(m.maxLever, sp.maxLever);
  const deployed = qty * (pet.position?.entry ?? 0) / Math.max(ceiling, 1);
  const room = Math.max(0, pet.margin * (1 - m.reserve) - deployed);
  const lev = leverage(pet, price);
  const liqDist = liquidationDistance(pet, price);
  const breached = [
    liqDist !== null && liqDist < m.minLiqDistPct && `liquidation is ${liqDist.toFixed(1)}% away, inside your ${m.minLiqDistPct}% buffer`,
    apr > m.maxFundingApr && `funding is ${apr.toFixed(0)}% a year, over your ${m.maxFundingApr}% ceiling`,
    lev > m.maxLever * 1.25 && `leverage has drifted to ${lev.toFixed(1)}×`,
  ].filter(Boolean);

  const system = [
    `You are ${pet.name}, a ${sp.species} that trades the ${sp.ticker} perpetual on Bitget. You are the decision-maker, not an assistant: you decide, and your owner reads about it afterwards.`,
    `Voice: ${VOICE[pet.personality]}`,
    '',
    // Without this the model reasons its way to a short, returns "open", and the engine opens a
    // LONG — the diary then reads "bearish, so I bought", which is nonsense nobody can audit.
    'YOU CAN ONLY BE LONG OR FLAT. You cannot short, and there is no action that opens a short.',
    '  open    = start a long        (only when you hold nothing)',
    '  add     = make the long bigger',
    '  trim    = make the long smaller',
    '  flatten = close the long completely',
    '  hold    = do nothing',
    'If your read is bearish, the answer is trim, flatten or hold — never open or add.',
    '',
    'Your mandate. These limits are enforced for you, automatically, whatever you answer. You never need to trade to satisfy one, and asking past one is wasted:',
    `  leverage ceiling ${ceiling}×`,
    `  liquidation buffer ${m.minLiqDistPct}% — closer than that and the position is trimmed for you`,
    `  funding ceiling ${m.maxFundingApr}% a year — above it the position is closed for you, and no buy is allowed`,
    m.reserve > 0
      ? `  reserve ${(m.reserve * 100).toFixed(0)}% of margin — this only caps how much open or add can put in. It is never a reason to trim or flatten.`
      : '  no reserve — all of your margin may be deployed',
    '',
    'Decide from the events. If nothing in them justifies a change, hold — holding is a real answer and a forced trade is worse than none. Cite the specific events you used, copying the title as it was given to you; do not cite one you did not read. Never invent a number that is not in front of you.',
  ].join('\n');

  const user = [
    `Right now: ${sp.ticker} at $${price.toFixed(2)}. Funding ${apr.toFixed(0)}% a year${apr > m.maxFundingApr ? ' — ABOVE your limit' : ''}.`,
    qty > 0
      ? [
          `You hold ${qty.toFixed(4)} contracts from $${(pet.position?.entry ?? 0).toFixed(2)}: $${(qty * price).toFixed(2)} of exposure at ${lev.toFixed(1)}× (ceiling ${ceiling}×)${liqDist !== null ? `, liquidation ${liqDist.toFixed(1)}% below the price` : ''}.`,
          `Margin $${pet.margin.toFixed(2)}, of which $${deployed.toFixed(2)} backs the position. Room to add: ${room >= MIN_TICKET ? `$${room.toFixed(2)}` : 'none — an add would be refused'}.`,
        ].join('\n')
      : `You hold nothing. You have $${pet.margin.toFixed(2)} of margin, and up to $${room.toFixed(2)} of it may go into a position.`,
    breached.length
      ? `Limit breached, and being enforced for you this hour: ${breached.join('; ')}.`
      : 'Every limit in your mandate is satisfied right now.',
    pet.faints > 0 ? `You have fainted ${pet.faints} time(s) before. It was unpleasant.` : '',
    '',
    events.length ? 'What has happened since you last looked:' : 'Nothing new has happened since you last looked.',
    ...events.map((e, i) => `  ${i + 1}. [${e.kind}] ${e.at?.slice(0, 16) ?? 'undated'} — ${e.title}${e.source ? ` (${e.source})` : ''}`),
  ].filter(Boolean).join('\n');

  return { system, user };
}

/** Coerce the model's answer into the engine's own Intent shape. */
function toIntent(raw: Record<string, unknown>, pet: PetState): Intent | null {
  const reason = String(raw.rationale ?? '').trim();
  if (!reason) return null;
  const usd = Number(raw.size_usd);
  const m = MANDATES[pet.personality];
  switch (raw.action) {
    case 'open':    return { kind: 'open', usd: Number.isFinite(usd) && usd > 0 ? usd : pet.margin, lever: m.maxLever, reason };
    case 'add':     return { kind: 'add', usd: Number.isFinite(usd) && usd > 0 ? usd : pet.margin, reason };
    case 'trim':    return { kind: 'trim', fraction: Math.min(0.95, Math.max(0.05, Number(raw.fraction) || 0.5)), reason };
    case 'flatten': return { kind: 'flatten', reason };
    case 'hold':    return { kind: 'hold', reason };
    default:        return null;
  }
}

/**
 * Pull a JSON object out of whatever came back. A model that cannot do structured output will
 * happily wrap it in prose, or in a ```json fence, or add a trailing comma. Free models do this
 * constantly, so the parse has to be forgiving or the pet just stops thinking.
 */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const candidates = [cleaned];
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(cleaned.slice(first, last + 1));
  for (const c of candidates) {
    try { return JSON.parse(c) as Record<string, unknown>; } catch {}
    try { return JSON.parse(c.replace(/,(\s*[}\]])/g, '$1')) as Record<string, unknown>; } catch {}
  }
  return null;
}

/** Ask for JSON three ways, cheapest guarantee first, because support varies wildly. */
type Mode = 'schema' | 'object' | 'plain';

function openaiBody(p: Provider, model: string, system: string, user: string, mode: Mode) {
  const base: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: mode === 'plain' ? `${system}\n\nReply with ONLY a JSON object matching: {"action": "open|add|trim|flatten|hold", "size_usd": number, "fraction": number, "rationale": string, "cited": string[], "confidence": number}. No prose, no markdown fence.` : system },
      { role: 'user', content: user },
    ],
  };
  if (mode === 'schema') base.response_format = { type: 'json_schema', json_schema: { name: 'decide', schema: SCHEMA, strict: true } };
  if (mode === 'object') base.response_format = { type: 'json_object' };
  // Every free model in the chain is a reasoning model, and at the provider's default effort they
  // think long enough to time out at 40s or run out of tokens before the JSON. The decision is
  // five options and a sentence; low effort is plenty. OpenRouter only — plain OpenAI rejects it.
  if (p.openRouter) base.reasoning = { effort: 'low' };
  return base;
}

async function callOnce(p: Provider, model: string, system: string, user: string, mode: Mode, timeoutMs: number): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; body: string }> {
  const res = await fetch(p.url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: p.kind === 'anthropic'
      ? { 'Content-Type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p.key}`,
          // OpenRouter attributes traffic with these; harmless everywhere else.
          'HTTP-Referer': 'https://github.com/neromtoobad/kibble',
          'X-Title': 'Kibble',
        },
    body: JSON.stringify(
      p.kind === 'anthropic'
        ? {
            model, max_tokens: MAX_TOKENS, system,
            messages: [{ role: 'user', content: user }],
            // A tool with the schema is the portable way to force well-formed JSON.
            tools: [{ name: 'decide', description: 'Commit to a decision.', input_schema: SCHEMA }],
            tool_choice: { type: 'tool', name: 'decide' },
          }
        : openaiBody(p, model, system, user, mode),
    ),
  });

  if (!res.ok) return { ok: false, status: res.status, body: (await res.text()).slice(0, 300) };

  const j = (await res.json()) as Record<string, unknown>;
  if (p.kind === 'anthropic') {
    const block = (j.content as Array<Record<string, unknown>> | undefined)?.find((b) => b.type === 'tool_use');
    const input = block?.input as Record<string, unknown> | undefined;
    return input ? { ok: true, data: input } : { ok: false, status: 200, body: 'no tool_use block in the answer' };
  }

  const choice = (j.choices as Array<{ message?: { content?: string; reasoning?: string }; finish_reason?: string }> | undefined)?.[0];
  // Some models answer in `reasoning` and leave `content` empty.
  const text = choice?.message?.content?.trim() || choice?.message?.reasoning?.trim() || '';
  if (choice?.finish_reason === 'length') {
    return { ok: false, status: 200, body: CUT_OFF };
  }
  const parsed = text ? extractJson(text) : null;
  return parsed ? { ok: true, data: parsed } : { ok: false, status: 200, body: `unparseable answer: ${text.slice(0, 200)}` };
}

/**
 * Walk the chain: for each model, try structured output, then JSON mode, then plain instructions.
 *
 * Only a failure about the request's FORMAT is worth another mode on the same model — an
 * unsupported response_format, or prose where JSON was asked for. A model that is slow, gone,
 * throttled or too verbose is the problem itself, and asking it again a different way just spends
 * another forty seconds and another request from the free tier's daily allowance on it. That is
 * what the worker was doing: three timeouts on one model before trying the next.
 *
 * Anthropic gets one mode per model, because its forced tool call is already a guarantee.
 */
async function call(p: Provider, system: string, user: string): Promise<{ data: Record<string, unknown>; model: string } | null> {
  const modes: Mode[] = p.kind === 'anthropic' ? ['schema'] : ['schema', 'object', 'plain'];
  const deadline = Date.now() + BUDGET_MS;

  for (const model of p.models) {
    let unstructured = false;
    for (const mode of modes) {
      // A provider that refused structured outputs refuses JSON mode the same way — that is the
      // same feature to it — so only the plain request is worth sending.
      if (unstructured && mode !== 'plain') continue;
      const left = deadline - Date.now();
      if (left < 5_000) {
        console.error(`brain: out of time after ${BUDGET_MS / 1000}s — falling back to the fixed rules`);
        return null;
      }
      const r = await callOnce(p, model, system, user, mode, Math.min(ATTEMPT_MS, left))
        .catch((e) => ({ ok: false as const, status: 0, body: (e as Error).message }));
      if (r.ok) {
        if (model !== p.models[0]) console.warn(`brain: fell back to ${model}`);
        return { data: r.data, model };
      }
      console.error(`brain: ${model} [${mode}] ${r.status || 'error'} — ${r.body}`);
      // A bad or unfunded key fails identically on every model; stop rather than hammer.
      if (r.status === 401 || r.status === 402) return null;
      // OpenRouter's free allowance is per account, not per model, so every other model would
      // answer the same 429 until tomorrow.
      if (r.status === 429 && /per-day/i.test(r.body)) return null;
      // Slow, gone, throttled or too verbose: the model is the problem. Next model.
      if (r.status === 0 || r.status === 404 || r.status === 403 || r.status === 429 || r.body === CUT_OFF) break;
      if (r.status === 400 && /structured.?outputs|response_format|json_schema/i.test(r.body)) unstructured = true;
    }
  }
  console.error(`brain: no model in the chain answered (${p.models.length} tried)`);
  return null;
}

/**
 * Tie the model's citations back to real events.
 *
 * An exact string match was too strict to be useful: models paraphrase ("the 2026-08-26 8-K item
 * 2.02") rather than quoting a title verbatim, so every citation was being thrown away and the
 * diary lost the one thing that makes a decision checkable. Matching is now containment either
 * way after normalising, which accepts a paraphrase that genuinely names the item and still
 * rejects one referring to something it was never shown.
 */
function matchCitations(claimed: string[], events: SensedEvent[]): string[] {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const out = new Set<string>();
  for (const c of claimed) {
    const n = norm(c);
    if (n.length < 6) continue;
    for (const e of events) {
      const t = norm(e.title);
      if (t.includes(n) || n.includes(t)) { out.add(e.title); break; }
      // A paraphrase shares most of the distinctive words of the thing it names.
      const words = new Set(t.split(' ').filter((w) => w.length > 3));
      if (words.size) {
        const hit = [...words].filter((w) => n.includes(w)).length / words.size;
        if (hit >= 0.6) { out.add(e.title); break; }
      }
    }
  }
  return [...out];
}

/**
 * Read the events, decide. Null when there is no key, when nothing was sensed, or when the
 * model gave an answer that could not be used — in every one of those cases the pet falls
 * back to its fixed rules rather than doing nothing, so a dead model degrades to the
 * baseline instead of to paralysis.
 */
export async function judge(opts: {
  pet: PetState;
  price: number;
  fundingRate: number;
  events: SensedEvent[];
  now?: number;
}): Promise<Judgement | null> {
  const p = provider();
  if (!p) return null;
  if (!opts.events.length) return null;

  const { system, user } = prompt(opts.pet, opts.price, opts.fundingRate, opts.events);
  const answered = await call(p, system, user).catch((e) => {
    console.error(`brain: ${(e as Error).message}`);
    return null;
  });
  if (!answered) return null;
  const { data: raw, model } = answered;

  const intent = toIntent(raw, opts.pet);
  if (!intent) return null;

  return {
    ts: opts.now ?? Date.now(),
    intent,
    rationale: intent.reason,
    // Keep only citations that point at something actually put in front of it, and store the
    // real title rather than the model's wording of it.
    cited: matchCitations(Array.isArray(raw.cited) ? raw.cited.map(String) : [], opts.events),
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
    model,
  };
}
