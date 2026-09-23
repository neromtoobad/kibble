import type { Metadata, Viewport } from 'next';
import { Fredoka, Nunito, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './tokens.css';
import { isNight, nyseSession } from '@/lib/session';
import { SessionTheme } from '@/components/SessionTheme';

// The theme is the market's session, so it cannot be decided at build time: prerendered, every
// page but home kept whatever the NYSE was doing when the deploy ran.
export const dynamic = 'force-dynamic';

const display = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Nunito({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Kibble',
  description: 'Adopt a Stockling that works the hours your shares cannot — an agent holding a tokenized-stock perpetual on Bitget, paying its own funding, and able to faint.',
};
export const viewport: Viewport = { themeColor: '#C8FF3D', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = isNight(nyseSession()) ? 'night' : 'day';
  return (
    <html lang="en" data-session={session} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased"><SessionTheme />{children}</body>
    </html>
  );
}
