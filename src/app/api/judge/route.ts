import { NextResponse } from 'next/server';
import { sense } from '@/lib/feeds';
import { hasModel, judge, modelName } from '@/lib/brain';
import { SPECIES, type Species } from '@/lib/pets';
import type { PetState } from '@/lib/pet-math';

// The pet thinks here rather than in the browser, because the model key belongs on the server.
// The client posts what its Stockling looks like, gets back a decision, and hands that decision
// to the same pure engine the hourly worker uses — so the app and the worker reach the same
// place by the same route.
//
// Returns `{ judgement: null }` rather than an error when no key is configured: that is the
// documented fallback, not a failure, and the pet carries on under its fixed rules.

export const runtime = 'nodejs';

type Body = { pet: PetState; price: number; fundingRate: number };

export async function POST(req: Request) {
  if (!hasModel()) return NextResponse.json({ judgement: null, reason: 'no-model' });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const { pet, price, fundingRate } = body;
  if (!pet?.species || !SPECIES[pet.species as Species['id']] || !Number.isFinite(price)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  try {
    // Only what has happened since this pet last ticked.
    const events = await sense(pet.species, pet.lastTickAt || pet.adoptedAt);
    if (!events.length) return NextResponse.json({ judgement: null, reason: 'nothing-new', model: modelName() });

    const judgement = await judge({ pet, price, fundingRate: fundingRate ?? 0, events });
    return NextResponse.json({ judgement, events: events.length, model: modelName() });
  } catch (e) {
    // A pet that cannot think falls back to its rules; it should never fail to exist.
    return NextResponse.json({ judgement: null, reason: (e as Error).message });
  }
}
