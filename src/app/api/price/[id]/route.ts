import { NextResponse } from 'next/server';
import { SPECIES, type Species } from '@/lib/pets';
import { quoteFor } from '@/lib/quote';
import { fundingApr } from '@/lib/strategy';

// The live print for a species' home perpetual on Bitget, plus what only a perpetual has:
// the index price of the share behind it, how far the two have drifted apart, and what it
// costs to hold. Public market data, no key.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = SPECIES[id as Species['id']];
  if (!sp) return NextResponse.json({ error: 'unknown species' }, { status: 404 });

  const q = await quoteFor(sp.ticker);
  return NextResponse.json(
    {
      price: q?.price ?? null,
      pct24h: q?.pct24h ?? 0,
      indexPrice: q?.indexPrice ?? null,
      basisPct: q?.basisPct ?? null,
      fundingRate: q?.fundingRate ?? 0,
      fundingApr: fundingApr(q?.fundingRate ?? 0),
      symbol: sp.symbol,
      source: q?.price != null ? 'bitget' : 'none',
    },
    { headers: { 'Cache-Control': 's-maxage=30' } },
  );
}
