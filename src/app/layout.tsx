import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ProgressProvider } from '@/context/ProgressContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Nav } from '@/components/Nav';
import { ThemeToggle } from '@/components/ThemeToggle';

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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`${geistSans.className} min-h-screen flex flex-col`}>
        <ThemeProvider>
          <ProgressProvider>
            <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
              <span className="font-bold text-gray-900 dark:text-gray-50">IBLearn</span>
              <ThemeToggle />
            </header>
            <div className="flex-1 flex flex-col">
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
              <Nav />
            </div>
          </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
