import type { Metadata } from 'next';
import { COURSES } from '@/lib/courses';
import { metaForLadderOverview } from '@/lib/seo/assessments';
import LadderOverviewClient from './LadderOverviewClient';

export function generateStaticParams() {
  return COURSES.map((course) => ({ courseId: course.id }));
}

/** Free overview of all five levels → indexable (the ladder is the exam-tier entry point). */
export async function generateMetadata(props: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await props.params;
  return metaForLadderOverview(courseId) ?? {};
}

export default async function LadderPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  return <LadderOverviewClient courseId={params.courseId} />;
}
