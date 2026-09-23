import { NextResponse } from 'next/server';
import { nyseCalendar } from '@/lib/session';

// NYSE closures and 13:00 early closes for this year and next, from the rule-based calendar in
// lib/session. The app no longer fetches this — every session check already consults the same
// calendar — but it stays as a read for anything outside the app that wants it.
export async function GET() {
  const year = new Date().getUTCFullYear();
  const years = [year, year + 1].map(nyseCalendar);
  return NextResponse.json(
    {
      dates: years.flatMap((c) => [...c.closed]),
      earlyCloses: years.flatMap((c) => [...c.early]),
      source: 'NYSE Rule 7.2, computed',
    },
    { headers: { 'Cache-Control': 's-maxage=86400' } },
  );
}
