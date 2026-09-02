import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';
import LoginClient, { LoginSkeleton } from './login-client';

// noindex, follow: a funnel step, not a destination. It stays crawlable on purpose — the
// header links it from every page, and those links have to keep passing equity onward
// (a robots.txt Disallow would leave the URL indexed-but-blocked instead).
export const metadata: Metadata = pageMeta({
  path: '/login',
  title: 'Sign in',
  description: 'Sign in or create an Octav Learning account with a one-time email code — no password to forget. Your notes, quizzes, diagnostics and exam results sync across every device.',
  indexable: false,
});

// The client reads `?next=` via useSearchParams, which requires a Suspense
// boundary on a prerendered (static-export) route — the fallback skeleton is
// the same card shape the client shows, so there is no jarring swap.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginClient />
    </Suspense>
  );
}
