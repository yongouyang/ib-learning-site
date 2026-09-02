import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSubjects } from '@/content/registry';
import { metaForTool } from '@/lib/seo/meta';
import { findTopic } from '@/lib/seo/topic-ref';
import QuizPageClient from './QuizPageClient';

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
 * noindex, follow + canonical to /study (§1.2): the quiz carries almost no unique prose,
 * so 217 of these in the index would compete with the study pages they exist to feed.
 * Still crawlable on purpose — a Disallow would make the directive unreadable and strand
 * the URLs as "Indexed, though blocked by robots.txt".
 */
export async function generateMetadata(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}): Promise<Metadata> {
  const { subjectId, topicId } = await props.params;
  const found = findTopic(subjectId, topicId);
  return found ? metaForTool(found.topic, found.subjectName, 'quiz') : {};
}

export default async function QuizPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading quiz…</div>}>
      <QuizPageClient subjectId={params.subjectId} topicId={params.topicId} />
    </Suspense>
  );
}
