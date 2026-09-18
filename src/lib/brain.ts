import type { SensedEvent } from './feeds';
import { MANDATES, fundingApr, type Intent } from './strategy';
import { SPECIES } from './pets';
import type { Personality, PetState } from './pet-math';

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
const MAX_TOKENS = 2000;

type Provider = { kind: 'anthropic' | 'openai'; key: string; model: string; url: string };

function provider(): Provider | null {
  const a = process.env.ANTHROPIC_API_KEY;
  if (a) return { kind: 'anthropic', key: a, model: process.env.NIGHT_SHIFT_MODEL ?? 'claude-opus-5', url: 'https://api.anthropic.com/v1/messages' };
  // Anything OpenAI-compatible: OpenAI itself, OpenRouter
  // (https://openrouter.ai/api/v1), or Bitget's Qwen endpoint
  // (https://hackathon.bitgetops.com/v1) if those credits come through.
  const o = process.env.OPENAI_API_KEY;
  if (o) {
    const base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    return { kind: 'openai', key: o, model: process.env.NIGHT_SHIFT_MODEL ?? 'gpt-4o-mini', url: `${base.replace(/\/$/, '')}/chat/completions` };
  }
  return null;
}

export const hasModel = () => provider() !== null;
export const modelName = () => provider()?.model ?? null;

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

  const system = [
    `You are ${pet.name}, a ${sp.species} that trades the ${sp.ticker} perpetual on Bitget. You are the decision-maker, not an assistant: you decide, and your owner reads about it afterwards.`,
    `Voice: ${VOICE[pet.personality]}`,
    '',
    'Your mandate — these are hard limits enforced after you answer, so asking for more is wasted:',
    `  leverage ceiling ${m.maxLever}×`,
    `  trim if liquidation is nearer than ${m.minLiqDistPct}%`,
    `  never hold a carry above ${m.maxFundingApr}% a year`,
    `  keep ${(m.reserve * 100).toFixed(0)}% of margin undeployed`,
    '',
    'Decide from the events. If nothing in them justifies a change, hold — holding is a real answer and a forced trade is worse than none. Cite the specific events you used; do not cite one you did not read. Never invent a number that is not in front of you.',
  ].join('\n');

  const user = [
    `Right now: ${sp.ticker} at $${price.toFixed(2)}. Funding ${apr.toFixed(0)}% a year${apr > m.maxFundingApr ? ' — ABOVE your limit' : ''}.`,
    qty > 0
      ? `You hold ${qty.toFixed(4)} contracts from $${(pet.position?.entry ?? 0).toFixed(2)}, with $${pet.margin.toFixed(2)} margin behind them.`
      : `You hold nothing. You have $${pet.margin.toFixed(2)} of margin to work with.`,
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

function openaiBody(p: Provider, system: string, user: string, mode: Mode) {
  const base: Record<string, unknown> = {
    model: p.model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: mode === 'plain' ? `${system}\n\nReply with ONLY a JSON object matching: {"action": "open|add|trim|flatten|hold", "size_usd": number, "fraction": number, "rationale": string, "cited": string[], "confidence": number}. No prose, no markdown fence.` : system },
      { role: 'user', content: user },
    ],
  };
  if (mode === 'schema') base.response_format = { type: 'json_schema', json_schema: { name: 'decide', schema: SCHEMA, strict: true } };
  if (mode === 'object') base.response_format = { type: 'json_object' };
  return base;
}

async function callOnce(p: Provider, system: string, user: string, mode: Mode): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; body: string }> {
  const res = await fetch(p.url, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: p.kind === 'anthropic'
      ? { 'Content-Type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p.key}`,
          // OpenRouter attributes traffic with these; harmless everywhere else.
          'HTTP-Referer': 'https://github.com/neromtoobad/night-shift',
          'X-Title': 'Night Shift',
        },
    body: JSON.stringify(
      p.kind === 'anthropic'
        ? {
            model: p.model, max_tokens: MAX_TOKENS, system,
            messages: [{ role: 'user', content: user }],
            // A tool with the schema is the portable way to force well-formed JSON.
            tools: [{ name: 'decide', description: 'Commit to a decision.', input_schema: SCHEMA }],
            tool_choice: { type: 'tool', name: 'decide' },
          }
        : openaiBody(p, system, user, mode),
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
    return { ok: false, status: 200, body: `answer cut off at ${MAX_TOKENS} tokens — raise MAX_TOKENS or pick a less verbose model` };
  }
  const parsed = text ? extractJson(text) : null;
  return parsed ? { ok: true, data: parsed } : { ok: false, status: 200, body: `unparseable answer: ${text.slice(0, 200)}` };
}

/**
 * Try structured output, then JSON mode, then plain instructions. Anthropic gets one shot
 * because its tool call is already a guarantee. This ladder is what lets a free OpenRouter
 * model — which usually rejects `json_schema` outright — still drive the pet.
 */
async function call(p: Provider, system: string, user: string): Promise<Record<string, unknown> | null> {
  const modes: Mode[] = p.kind === 'anthropic' ? ['schema'] : ['schema', 'object', 'plain'];
  for (const mode of modes) {
    const r = await callOnce(p, system, user, mode).catch((e) => ({ ok: false as const, status: 0, body: (e as Error).message }));
    if (r.ok) return r.data;
    const last = mode === modes[modes.length - 1];
    console.error(`brain: ${p.model} [${mode}] ${r.status || 'error'} — ${r.body}`);
    // 401/402/429 will not improve by asking differently.
    if (r.status === 401 || r.status === 402 || r.status === 429) return null;
    if (last) return null;
  }
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
  const raw = await call(p, system, user).catch((e) => {
    console.error(`brain: ${(e as Error).message}`);
    return null;
  });
  if (!raw) return null;

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
    model: p.model,
  };
}
