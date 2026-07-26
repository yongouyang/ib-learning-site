import { Suspense } from 'react';
import { getSubjects } from '@/content/registry';
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

export default async function FlashcardsPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading flashcards…</div>}>
      <FlashcardsPageClient subjectId={params.subjectId} topicId={params.topicId} />
    </Suspense>
  );
}
