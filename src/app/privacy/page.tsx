import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LegalDocument, legalBody } from '@/components/LegalDocument';
import { pageMeta } from '@/lib/seo/page-meta';

// The published Privacy Notice — see the note on src/app/terms/page.tsx: the copy is
// docs/privacy-notice-draft.md, rendered verbatim so what was reviewed is what ships.
export const metadata: Metadata = pageMeta({
  path: '/privacy',
  title: 'Privacy notice',
  description:
    'What personal data Octav Learning collects, why, who it is shared with, how long it is kept, the cookies we set, and how to ask for a copy or deletion of your data.',
});

export default function PrivacyPage() {
  const source = readFileSync(join(process.cwd(), 'docs', 'privacy-notice-draft.md'), 'utf8');
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Privacy Notice</h1>
      <LegalDocument source={legalBody(source, 'Privacy Notice')} />
    </div>
  );
}
