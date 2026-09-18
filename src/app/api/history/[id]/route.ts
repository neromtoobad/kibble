import { NextResponse } from 'next/server';
import { fetchBars } from '@/lib/bars';
import { SPECIES, type Species } from '@/lib/pets';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SPECIES[id as Species['id']]) return NextResponse.json({ error: 'unknown species' }, { status: 404 });

  // Funding rides along with the bars: the engine needs both to replay a window, and one
  // round trip is one round trip.
  const { bars, funding, source } = await fetchBars(id as Species['id']);
  const headers = source === 'bitget' ? { 'Cache-Control': 's-maxage=300' } : undefined;
  return NextResponse.json({ bars, funding, source }, headers ? { headers } : undefined);
}
