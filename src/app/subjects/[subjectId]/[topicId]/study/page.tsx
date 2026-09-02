import type { Metadata } from 'next';
import { getSubjects } from '@/content/registry';
import { metaForTopic } from '@/lib/seo/meta';
import { findTopic } from '@/lib/seo/topic-ref';
import StudyPageClient from './StudyPageClient';

export function generateStaticParams() {
  const params: { subjectId: string; topicId: string }[] = [];
  for (const subject of getSubjects()) {
    for (const topic of subject.topics) {
      params.push({ subjectId: subject.id, topicId: topic.id });
    }
  }
  return params;
}

/**
 * The indexed canonical leaf of the whole site (217 pages). Before this, every one of
 * them shipped the root fallback <title>"Octav Learning" with no description or
 * canonical — docs/seo-technical-plan.md §2.4.
 */
export async function generateMetadata(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}): Promise<Metadata> {
  const { subjectId, topicId } = await props.params;
  const found = findTopic(subjectId, topicId);
  return found ? metaForTopic(found.topic, found.subjectName) : {};
}

export default async function StudyPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const params = await props.params;
  return <StudyPageClient subjectId={params.subjectId} topicId={params.topicId} />;
}
