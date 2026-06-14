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

export default function FlashcardsPage({ params }: { params: { subjectId: string; topicId: string } }) {
  return <FlashcardsPageClient subjectId={params.subjectId} topicId={params.topicId} />;
}
