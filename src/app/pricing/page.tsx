import type { Metadata } from 'next';
import Link from 'next/link';
import { BillingPanel } from '@/components/BillingPanel';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { pageMeta } from '@/lib/seo/page-meta';

// The tier split (docs/entitlement-policy.md) is stated statically; the CTAs are
// the E4.3 client component, which reads live billing state from
// /api/subscriptions/status and hides itself when billing is unconfigured (prod,
// until a LIVE key set exists) instead of offering a button that 503s.

// The root layout's title.template appends " · Octav Learning"; a title that already
// contains the brand renders it twice (the live defect this replaces).
export const metadata: Metadata = pageMeta({
  path: '/pricing',
  title: 'Pricing — free and Premium study plans',
  description: 'What is free on Octav Learning and what Premium adds: illustrated notes, flashcards, quizzes and diagnostics are free; timed mock exams, the full paper sets and unlimited AI marking are Premium.',
});

export default function PricingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Pricing' }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Pricing</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mb-6">
        Everything you need to start is free. Premium adds unlimited AI marking and the full exam tier — the
        first 14 days are free.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">Free</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">For every student, forever.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>All notes, flashcards and quizzes across KS3 · IGCSE · IB DP</li>
            <li>Diagnostics and progress tracking across devices with a free account</li>
            <li>30 AI-marked answers per month with a free account</li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">Premium</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Everything, for one student or a whole family.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300 mb-4">
            <li>Unlimited AI marking on your free-response answers</li>
            <li>The full practice-exam tier: every paper set, upper ladder levels, timed mock mode</li>
          </ul>
          <BillingPanel variant="pricing" />
        </section>
      </div>

      <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        <Link href="/" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Back to studying
        </Link>
      </p>
    </div>
  );
}
