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

export default function QuizPage({ params }: { params: { subjectId: string; topicId: string } }) {
  return <QuizPageClient subjectId={params.subjectId} topicId={params.topicId} />;
}
