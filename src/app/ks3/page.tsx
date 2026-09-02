import type { Metadata } from 'next';
import Link from 'next/link';
import { TIERS, tierSubjectPath } from '@/lib/seo/curriculum';
import { metaForTierHub, tierSubjects } from '@/lib/seo/hubs';
import { subjectEmoji } from '@/lib/subject-emoji';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Tier hub (docs/seo-technical-plan.md §1.1, step S3): indexable landing page listing
// every subject that has KS3 content. Static server render — no client state needed.

export function generateMetadata(): Metadata {
  return metaForTierHub('ks3');
}

export default function Ks3HubPage() {
  const hubs = tierSubjects('ks3');
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: TIERS.ks3.label }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">KS3 revision</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
        Every Key Stage 3 subject with illustrated notes, flashcards and quizzes for Years 7–9 — pick a subject to start.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {hubs.map(({ subject, topics }) => (
          <Link
            key={subject.id}
            href={tierSubjectPath('ks3', subject.id)}
            className="card p-4 h-full block hover:shadow-md pressable"
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] text-2xl shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${subject.accentColor} 14%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${subject.accentColor} 22%, transparent)`,
                }}
                aria-hidden="true"
              >
                {subjectEmoji(subject.id)}
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-gray-50">{subject.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{topics.length} topics</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
