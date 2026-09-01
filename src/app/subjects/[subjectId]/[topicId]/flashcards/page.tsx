import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSubjects } from '@/content/registry';
import { metaForTool } from '@/lib/seo/meta';
import { findTopic } from '@/lib/seo/topic-ref';
import FlashcardsPageClient from './FlashcardsPageClient';

export function generateStaticParams() {
  const params: { subjectId: string; topicId: string }[] = [];
  for (const subject of getSubjects()) {
    for (const topic of subject.topics) {
      params.push({ subjectId: subject.id, topicId: topic.id });
    }
  }
  return params;
}

/** noindex, follow + canonical to /study — see the quiz page note; never in a sitemap. */
export async function generateMetadata(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}): Promise<Metadata> {
  const { subjectId, topicId } = await props.params;
  const found = findTopic(subjectId, topicId);
  return found ? metaForTool(found.topic, found.subjectName, 'flashcards') : {};
}

export default async function FlashcardsPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading flashcards…</div>}>
      <FlashcardsPageClient subjectId={params.subjectId} topicId={params.topicId} />
    </Suspense>
  );
}
