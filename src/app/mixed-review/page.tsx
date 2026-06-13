import { Suspense } from 'react';
import MixedReviewClient from './MixedReviewClient';

export default function MixedReviewPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading mixed review…</div>}>
      <MixedReviewClient />
    </Suspense>
  );
}
