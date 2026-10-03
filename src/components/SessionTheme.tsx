'use client';
import { useEffect } from 'react';
import { useNow, useSearch } from '@/lib/client';
import { isNight, nyseSession } from '@/lib/session';

/**
 * Keeps <html data-session> on the market's clock after first paint. The layout sets it per
 * request; this flips it at the bell for a tab left open, on every page rather than only the home
 * screen. The site stays light whatever the clock says; `?night=1` switches to the night look
 * anywhere, for demos.
 */
export function SessionTheme() {
  const now = useNow(60_000);
  const forced = useSearch().get('night');
  useEffect(() => {
    if (!now) return;
    const night = forced ? true : isNight(nyseSession(new Date(now)));
    document.documentElement.dataset.session = night ? 'night' : 'day';
    document.documentElement.dataset.theme = forced ? 'dark' : 'light';
  }, [now, forced]);
  return null;
}
