import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { pageMeta } from '@/lib/seo/page-meta';

/**
 * The homepage is the one page of 809 that shipped with NO robots meta and NO canonical:
 * this file was 'use client', and a client component cannot export metadata — and unlike
 * /account, /progress and /admin there is no segment layout below the root to carry it.
 * So the tree moved verbatim into HomePageClient (zero DOM/behaviour change) and this
 * server wrapper owns the metadata, the same fix the segment layouts carry elsewhere.
 *
 * `absolute: true` keeps the <title> exactly "Octav Learning" — the root layout's
 * `title.template` must not append the brand a second time (AGENTS.md SEO bullet).
 */
export const metadata: Metadata = pageMeta({
  path: '/',
  title: 'Octav Learning',
  description:
    'Illustrated notes, smart flashcards, diagnostic tests and timed mock exams for KS3, IGCSE and IB DP — across Math, English and the Sciences.',
  absolute: true,
});

export default function HomePage() {
  return <HomePageClient />;
}
