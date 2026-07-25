import { COURSES } from '@/lib/courses';
import LadderOverviewClient from './LadderOverviewClient';

export function generateStaticParams() {
  return COURSES.map((course) => ({ courseId: course.id }));
}

export default async function LadderPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  return <LadderOverviewClient courseId={params.courseId} />;
}
