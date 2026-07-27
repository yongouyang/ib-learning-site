import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Offline — IBLearn',
};

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
