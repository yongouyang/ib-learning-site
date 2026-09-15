import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LegalDocument, legalBody } from '@/components/LegalDocument';
import { pageMeta } from '@/lib/seo/page-meta';

// The published Terms of Use. The copy lives in docs/terms-of-use-draft.md (the file
// a lawyer reviews is the file this page shows), rendered by <LegalDocument>, which
// has a unit test asserting no clause can be dropped silently.
//
// Adding or renaming a section here means re-running the quality gates: the sitemap
// entry is in scripts/generate-sitemaps.ts (coreEntries) and the live SEO check
// asserts this URL stays live and indexable.
export const metadata: Metadata = pageMeta({
  path: '/terms',
  title: 'Terms of use',
  description:
    'The terms that apply to Octav Learning: accounts, free and Premium subscriptions, trials, renewals, refunds, acceptable use, and what you may do with the notes, flashcards and questions.',
});

export default function TermsPage() {
  const source = readFileSync(join(process.cwd(), 'docs', 'terms-of-use-draft.md'), 'utf8');
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Terms of Use</h1>
      <LegalDocument source={legalBody(source, 'Terms of Use')} />
    </div>
  );
}
