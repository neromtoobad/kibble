import { hasModel, judge, modelName } from '../src/lib/brain';
import { sense } from '../src/lib/feeds';
import { gate, MANDATES } from '../src/lib/strategy';
import { SPECIES } from '../src/lib/pets';
import type { PetState } from '../src/lib/pet-math';

// One real call, end to end: sense the news, ask the model, run its answer through the mandate.
// This is the check that the key works and the model can actually be understood — everything
// else about the decision path is already covered by gatetest, which needs no key.

const species = (process.argv[2] ?? 'nova') as keyof typeof SPECIES;
const personality = (process.argv[3] ?? 'owl') as PetState['personality'];

async function main() {
  if (!hasModel()) {
    console.error('\nNo key. Put ONE of these in .env.local:\n');
    console.error('  ANTHROPIC_API_KEY=sk-ant-...');
    console.error('  OPENAI_API_KEY=sk-...                         # OpenAI');
    console.error('  OPENAI_API_KEY=sk-or-v1-...                   # OpenRouter, plus:');
    console.error('  OPENAI_BASE_URL=https://openrouter.ai/api/v1');
    console.error('  KIBBLE_MODEL=<model slug>\n');
    process.exit(1);
  }

  const sp = SPECIES[species];
  console.log(`\nmodel: ${modelName()}`);
  console.log(`pet:   a ${personality} holding ${sp.ticker} (${sp.symbol})\n`);

  const events = await sense(species);
  console.log(`sensed ${events.length} events:`);
  for (const e of events.slice(0, 6)) console.log(`   [${e.kind}] ${e.title.slice(0, 74)}`);
  if (!events.length) { console.error('\nNo events — nothing to judge. The feeds may be unreachable.'); process.exit(1); }

  const pet: PetState = {
    species, name: 'Testling', personality,
    adoptedAt: Date.now() - 86_400_000, lastFed: Date.now(), streak: 1, lastVisitDay: '',
    margin: 100, position: null, realized: 0, fundingPaid: 0, faints: 0,
    marks: [], lastTickAt: Date.now() - 86_400_000, diary: [], proposal: null,
  };

  const t = Date.now();
  const j = await judge({ pet, price: 220, fundingRate: 0.0003, events });
  const ms = Date.now() - t;

  if (!j) {
    console.error(`\n✗ no usable answer after ${ms}ms — the error above says why.`);
    process.exit(1);
  }

  console.log(`\n✓ decided in ${ms}ms`);
  console.log(`   action:     ${j.intent.kind}`);
  console.log(`   confidence: ${(j.confidence * 100).toFixed(0)}%`);
  console.log(`   rationale:  ${j.rationale}`);
  console.log(`   cited:      ${j.cited.length ? j.cited.map((c) => `\n                 · ${c.slice(0, 70)}`).join('') : '(nothing it was actually shown)'}`);

  // And what the mandate does about it — the half that does not depend on the model.
  const g = gate(MANDATES[personality], {
    margin: 100, qty: 0, entry: 0, price: 220, lever: 0,
    liqDistPct: null, fundingRate: 0.0003, lastActionAt: 0, totalFed: 100,
  }, j.intent, sp.maxLever);

  console.log(`\n   through the mandate → ${g.intent.kind}`);
  if (g.veto) console.log(`   VETOED: ${g.veto}`);
  else if (g.clamped) console.log(`   CLAMPED: ${g.clamped}`);
  else console.log('   passed as proposed');
  console.log();
}

main();
