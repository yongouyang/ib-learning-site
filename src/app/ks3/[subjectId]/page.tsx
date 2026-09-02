import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TIERS, STUDY_PATH, tierHubPath } from '@/lib/seo/curriculum';
import { subjectSeoName } from '@/lib/seo/meta';
import { metaForTierSubject, tierSubject, tierSubjects } from '@/lib/seo/hubs';
import { groupTopicsByStage } from '@/lib/topic-groups';
import InlineMath from '@/components/InlineMath';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// Tier×subject hub (docs/seo-technical-plan.md §1.1, step S3): an index of the subject's
// KS3 topic study pages, grouped exactly like the subject page (year, then strand).
// Static params come from the registry-derived hub set, so the sitemap's /ks3/<subject>
// URLs and these routes can never disagree.

export function generateStaticParams() {
  return tierSubjects('ks3').map(({ subject }) => ({ subjectId: subject.id }));
}

export async function generateMetadata(props: { params: Promise<{ subjectId: string }> }): Promise<Metadata> {
  const { subjectId } = await props.params;
  return metaForTierSubject('ks3', subjectId) ?? {};
}

export default async function Ks3SubjectHubPage(props: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await props.params;
  const hub = tierSubject('ks3', subjectId);
  if (!hub) notFound();
  const title = `${TIERS.ks3.label} ${subjectSeoName(hub.subject.name)}`;
  const groups = groupTopicsByStage(hub.topics);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: tierHubPath('ks3'), label: TIERS.ks3.label },
          { label: title },
        ]}
      />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">{title}</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
        {hub.topics.length} Key Stage 3 {subjectSeoName(hub.subject.name)} topics, in curriculum order — open one to start studying.
      </p>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {group.label}
              <span className="ml-1.5 font-normal normal-case">({group.topics.length})</span>
            </h2>
            <div className="space-y-3">
              {group.topics.map((topic) => (
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
