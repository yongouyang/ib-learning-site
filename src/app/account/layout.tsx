import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';

/**
 * Octav Learning account is rendered by a `'use client'` page.tsx, and a client component cannot export
 * metadata at all — so the segment metadata lives here instead. The layout returns
 * `children` untouched: no wrapper element, no DOM change, no reflow.
 *
 * noindex, follow: the page is only meaningful to the signed-in visitor, but the header
 * links it on every page, so its links must still be crawlable.
 */
export const metadata: Metadata = pageMeta({
  path: '/account',
  title: 'Octav Learning account',
  description: 'Your Octav Learning account: profiles, subscription, progress sync, data export and deletion.',
  indexable: false,
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
