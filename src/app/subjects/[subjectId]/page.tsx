import { getSubjects } from '@/content/registry';
import SubjectPageClient from './SubjectPageClient';

export function generateStaticParams() {
  return getSubjects().map((subject) => ({ subjectId: subject.id }));
}

export default function SubjectPage({ params }: { params: { subjectId: string } }) {
  return <SubjectPageClient subjectId={params.subjectId} />;
}
