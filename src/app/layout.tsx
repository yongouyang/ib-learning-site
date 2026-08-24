import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import './globals.css';
import { ProgressProvider } from '@/context/ProgressContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { EntitlementsProvider } from '@/context/EntitlementsContext';
import { Nav } from '@/components/Nav';
import { HeaderNav } from '@/components/HeaderNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccountButton } from '@/components/AccountButton';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateToast } from '@/components/UpdateToast';
import { HeaderLogo } from '@/components/HeaderLogo';
import { DevEnvironmentIndicator } from '@/components/DevEnvironmentIndicator';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://octavlearning.com'),
  title: {
    default: 'Octav Learning',
    template: '%s · Octav Learning',
  },
  description:
    'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for KS3, IGCSE and IB DP — across Math, English and the Sciences.',
  openGraph: {
    title: 'Octav Learning',
    description:
      'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for KS3, IGCSE and IB DP — across Math, English and the Sciences.',
    url: 'https://octavlearning.com',
    siteName: 'Octav Learning',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Octav Learning',
    description:
      'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for KS3, IGCSE and IB DP — across Math, English and the Sciences.',
  },
  appleWebApp: {
    capable: true,
    title: 'Octav Learning',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-favicon-app-icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`${geistSans.className} min-h-screen flex flex-col`}>
        <ThemeProvider>
          <AuthProvider>
          <EntitlementsProvider>
          <ProgressProvider>
            <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
              <HeaderLogo />
              <div className="flex items-center gap-2">
                <HeaderNav />
                <AccountButton variant="desktop" />
                <ThemeToggle />
              </div>
            </header>
            <div className="flex-1 flex flex-col">
              {/* Mobile floating account + theme cluster — desktop has both in the
                  header. 44px targets (AccountButton mobile + ThemeToggle size=lg),
                  solid bg + rounded-xl to match the button/chip radius token and
                  stay legible over scrolling content. */}
              <div className="md:hidden fixed top-4 right-4 z-40">
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center">
                  <AccountButton variant="mobile" />
                  <ThemeToggle size="lg" />
                </div>
              </div>
              <main className="flex-1 pb-24 md:pb-0">{children}</main>
              <footer className="px-6 pt-4 pb-24 md:pb-4 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 space-y-1">
                <p>
                  &copy; {new Date().getFullYear()} Octav Learning. All rights reserved.{' '}
                  <Link href="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Terms of Use
                  </Link>
                </p>
                <p>
                  Octav Learning is an independent study resource and is not endorsed by or affiliated with the International Baccalaureate Organization (IBO) or Cambridge Assessment International Education (CAIE).
                </p>
              </footer>
              <Nav />
            </div>
            <ServiceWorkerRegistration />
            <AnalyticsTracker />
            <OfflineBanner />
            <UpdateToast />
            <DevEnvironmentIndicator />
          </ProgressProvider>
          </EntitlementsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
