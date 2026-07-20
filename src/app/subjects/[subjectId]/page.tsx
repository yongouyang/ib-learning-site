import { getSubjects } from '@/content/registry';
import SubjectPageClient from './SubjectPageClient';

export function generateStaticParams() {
  return getSubjects().map((subject) => ({ subjectId: subject.id }));
}

export default async function SubjectPage(props: { params: Promise<{ subjectId: string }> }) {
  const params = await props.params;
  return <SubjectPageClient subjectId={params.subjectId} />;
}
