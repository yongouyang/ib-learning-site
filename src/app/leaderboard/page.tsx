import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';
import LeaderboardClient from './leaderboard-client';

// noindex, follow: the board is per-week, opt-in and made of other people's handles —
// thin, churning and semi-personal, so it is a page users visit, never a page to rank.
export const metadata: Metadata = pageMeta({
  path: '/leaderboard',
  title: 'Weekly leaderboard',
  description: 'How this week stacks up across your stage — XP from quizzes, exams, the revision ladder and flashcards, with anonymous handles only.',
  indexable: false,
});

// Static-export page: the board is session-dependent, so all data fetching
// happens client-side (the /admin/analytics pattern). No search params are
// read, so no Suspense boundary is needed.
export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
