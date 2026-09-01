import type { Metadata } from 'next';
import { getSubject, getSubjects } from '@/content/registry';
import type { SubjectId } from '@/content/types';
import { metaForSubject } from '@/lib/seo/meta';
import SubjectPageClient from './SubjectPageClient';

export function generateStaticParams() {
  return getSubjects().map((subject) => ({ subjectId: subject.id }));
}

// Curriculum-qualified title + self-canonical (docs/seo-technical-plan.md §2.4). Derived
// from the registry so titles, the sitemap and JSON-LD can never disagree.
export async function generateMetadata(props: {
  params: Promise<{ subjectId: string }>;
}): Promise<Metadata> {
  const { subjectId } = await props.params;
  const subject = getSubject(subjectId as SubjectId);
  return subject ? metaForSubject(subject) : {};
}

export default async function SubjectPage(props: { params: Promise<{ subjectId: string }> }) {
  const params = await props.params;
  return <SubjectPageClient subjectId={params.subjectId} />;
}
