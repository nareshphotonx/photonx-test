import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'PhotonX WorkOS', template: '%s · PhotonX WorkOS' },
  description: 'The all-in-one work OS for modern teams. Projects, tasks, attendance, leave, and AI assistant.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
