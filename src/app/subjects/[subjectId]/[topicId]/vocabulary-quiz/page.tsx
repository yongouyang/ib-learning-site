import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject } from '@/content/registry';
import { getContentTopic } from '@/content/registry.content';
import { metaForTool } from '@/lib/seo/meta';
import { findTopic } from '@/lib/seo/topic-ref';
import VocabularyQuizPageClient from './VocabularyQuizPageClient';

export function generateStaticParams() {
  return (getSubject('german')?.topics ?? []).map((topic) => ({
    subjectId: 'german',
    topicId: topic.id,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}): Promise<Metadata> {
  const { subjectId, topicId } = await props.params;
  if (subjectId !== 'german') return {};
  const found = findTopic(subjectId, topicId);
  return found ? metaForTool(found.topic, found.subjectName, 'vocabulary-quiz') : {};
}

export default async function VocabularyQuizPage(props: {
  params: Promise<{ subjectId: string; topicId: string }>;
}) {
  const params = await props.params;
  if (params.subjectId !== 'german') notFound();
  const topic = getContentTopic('german', params.topicId);
  if (!topic) notFound();

  return (
    <VocabularyQuizPageClient
      key={topic.id}
      subjectId="german"
      topicId={topic.id}
      topicTitle={topic.title}
      subjectName={getSubject('german')?.name ?? 'German'}
      flashcards={topic.flashcards}
    />
  );
}
