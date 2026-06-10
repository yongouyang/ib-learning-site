import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ProgressProvider } from '@/context/ProgressContext';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'IBLearn',
  description: 'Learn and practise for IB exams',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ProgressProvider>
          <div className="flex-1 flex flex-col">
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <Nav />
          </div>
        </ProgressProvider>
      </body>
    </html>
  );
}
