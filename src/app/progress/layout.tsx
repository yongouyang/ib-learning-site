import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';

/**
 * Your learning progress is rendered by a `'use client'` page.tsx, and a client component cannot export
 * metadata at all — so the segment metadata lives here instead. The layout returns
 * `children` untouched: no wrapper element, no DOM change, no reflow.
 *
 * noindex, follow: the page is only meaningful to the signed-in visitor, but the header
 * links it on every page, so its links must still be crawlable.
 */
export const metadata: Metadata = pageMeta({
  path: '/progress',
  title: 'Your learning progress',
  description: 'Your Octav Learning progress — stars, streaks, mastered topics and weak points across every subject you study.',
  indexable: false,
});

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
