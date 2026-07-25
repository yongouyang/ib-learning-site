import { Suspense } from 'react';
import { getSubjects } from '@/content/registry';
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

export default async function QuizPage(props: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading quiz…</div>}>
      <QuizPageClient subjectId={params.subjectId} topicId={params.topicId} />
    </Suspense>
  );
}
