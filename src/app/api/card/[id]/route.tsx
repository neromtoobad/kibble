import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCard } from '@/lib/card';
import { cardImage } from '@/lib/card-image';

// The share card: what /p/<id> unfurls to on X. Rendered on request from the live record, so a card
// posted today and opened next week shows next week's numbers — the same ones /proof shows.

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await loadCard(id).catch(() => null);
  if (!card) return new Response('No such Stockling', { status: 404 });
  const art = await readFile(join(process.cwd(), 'public', 'pets', card.family, `${card.mood}.png`)).catch(() => null);
  return await cardImage(card, art);
}
