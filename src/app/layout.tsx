import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import './globals.css';
import { ProgressProvider } from '@/context/ProgressContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Nav } from '@/components/Nav';
import { HeaderNav } from '@/components/HeaderNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { OfflineBanner } from '@/components/OfflineBanner';

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
  title: 'IBLearn',
  description: 'Learn and practise for IB exams',
  appleWebApp: {
    capable: true,
    title: 'IBLearn',
    statusBarStyle: 'default',
  },
  icons: {
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
          <ProgressProvider>
            <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
              <Link href="/" className="font-bold text-gray-900 dark:text-gray-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">IBLearn</Link>
              <div className="flex items-center gap-2">
                <HeaderNav />
                <ThemeToggle />
              </div>
            </header>
            <div className="flex-1 flex flex-col">
              <main className="flex-1 pb-24 md:pb-0">{children}</main>
              <footer className="px-6 pt-4 pb-24 md:pb-4 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
                IBLearn is an independent study resource and is not endorsed by or affiliated with the International Baccalaureate Organization (IBO) or Cambridge Assessment International Education (CAIE).
              </footer>
              <Nav />
            </div>
            <ServiceWorkerRegistration />
            <OfflineBanner />
          </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
