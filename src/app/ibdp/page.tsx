import type { Metadata } from 'next';
import Link from 'next/link';
import { TIERS, tierSubjectPath } from '@/lib/seo/curriculum';
import { metaForTierHub, tierSubjects } from '@/lib/seo/hubs';
import { subjectEmoji } from '@/lib/subject-emoji';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Tier hub (docs/seo-technical-plan.md §1.1, step S3): indexable landing page listing
// every subject that has IB DP content. IGCSE has no tier hub — the tier is empty and
// the plan is explicit that an empty tier gets no route.

export function generateMetadata(): Metadata {
  return metaForTierHub('ibdp');
}

export default function IbdpHubPage() {
  const hubs = tierSubjects('ibdp');
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: TIERS.ibdp.label }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">IB DP revision</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
        IB Diploma Programme topics with illustrated notes, flashcards and practice questions — pick a subject to start.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {hubs.map(({ subject, topics }) => (
          <Link
            key={subject.id}
            href={tierSubjectPath('ibdp', subject.id)}
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
