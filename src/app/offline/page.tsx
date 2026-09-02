import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo/page-meta';

// noindex: this shell is what the service worker serves when a page is unavailable, so
// indexing it would put an "you are offline" page in the search results.
export const metadata: Metadata = pageMeta({
  path: '/offline',
  title: 'You are offline',
  description: 'Octav Learning keeps the pages you have opened available offline. Reconnect to load anything else.',
  indexable: false,
});

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 max-w-md text-gray-600 dark:text-gray-400">
        This page wasn&rsquo;t cached yet. Pages you&rsquo;ve visited before still
        work offline — reconnect to load new ones.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
