import type { Metadata } from 'next';
import LeaderboardClient from './leaderboard-client';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'The weekly leaderboard — see how you compare, anonymously.',
};

// Static-export page: the board is session-dependent, so all data fetching
// happens client-side (the /admin/analytics pattern). No search params are
// read, so no Suspense boundary is needed.
export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
