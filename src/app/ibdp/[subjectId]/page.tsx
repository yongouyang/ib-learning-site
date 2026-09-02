import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TIERS, STUDY_PATH, tierHubPath } from '@/lib/seo/curriculum';
import { metaForTierSubject, tierSubject, tierSubjects } from '@/lib/seo/hubs';
import { subjectSeoName } from '@/lib/seo/meta';
import { COURSES } from '@/lib/courses';
import InlineMath from '@/components/InlineMath';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Tier×subject hub for the IB Diploma (docs/seo-technical-plan.md §1.1, step S3).
// The URL segment is the SUBJECT id (`/ibdp/math`) — that is the shape the sitemap
// generator emits (coreEntries groups tier topics by subjectId), and static params are
// derived from the same hub set, so the feed and these routes cannot disagree.
// Topics are listed per DP course (src/lib/courses.ts); a course with zero dp-stage
// topics renders nothing and no route exists for a subject without dp content.

export function generateStaticParams() {
  return tierSubjects('ibdp').map(({ subject }) => ({ subjectId: subject.id }));
}

export async function generateMetadata(props: { params: Promise<{ subjectId: string }> }): Promise<Metadata> {
  const { subjectId } = await props.params;
  return metaForTierSubject('ibdp', subjectId) ?? {};
}

export default async function IbdpSubjectHubPage(props: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await props.params;
  const hub = tierSubject('ibdp', subjectId);
  if (!hub) notFound();
  const title = `${TIERS.ibdp.label} ${subjectSeoName(hub.subject.name)}`;
  const sections = COURSES.map((course) => ({ course, topics: hub.topics.filter((t) => course.matches(t)) })).filter(
    (s) => s.topics.length > 0,
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: tierHubPath('ibdp'), label: TIERS.ibdp.label },
          { label: title },
        ]}
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">{title}</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
        {hub.topics.length} IB Diploma Programme {subjectSeoName(hub.subject.name)} topics — open one to start studying.
      </p>
      <div className="space-y-6">
        {sections.map(({ course, topics }) => (
          <section key={course.id} aria-label={course.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {course.title}
              <span className="ml-1.5 font-normal normal-case">({topics.length})</span>
            </h2>
            <div className="space-y-3">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={STUDY_PATH(topic)}
                  className="card p-4 border-l-4 block hover:shadow-md pressable"
                  style={{ borderLeftColor: hub.subject.accentColor }}
                >
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">{topic.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <InlineMath text={topic.description} />
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
