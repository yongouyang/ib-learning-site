import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/page-meta';
import MixedReviewClient from './MixedReviewClient';

// noindex, follow: a session-built drill over your own weak points — there is nothing for
// a search engine to match on, and it is reached from /progress, not from search.
export const metadata: Metadata = pageMeta({
  path: '/mixed-review',
  title: 'Mixed review',
  description: 'Mix questions from across the topics you have studied so old learning stays retrievable. Built from your own quiz and exam history.',
  indexable: false,
});

export default function MixedReviewPage() {
  return (
    // The fallback matches MixedReviewClient's own loading card class-for-class: a bare div here made
    // the sentence visibly pop from plain text into a white card the moment the client took over.
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto px-4 py-8">
          <p
            className="card p-6 text-center text-gray-500 dark:text-gray-400"
            role="status"
            aria-busy="true"
          >
            Loading mixed review…
          </p>
        </div>
      }
    >
      <MixedReviewClient />
    </Suspense>
  );
}
