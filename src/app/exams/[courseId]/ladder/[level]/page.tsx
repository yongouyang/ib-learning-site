import { COURSES } from '@/lib/courses';
import { LADDER_LEVELS } from '@/lib/ladder';
import LadderRunnerClient from './LadderRunnerClient';

export function generateStaticParams() {
  return COURSES.flatMap((course) =>
    LADDER_LEVELS.map((level) => ({ courseId: course.id, level: String(level.level) }))
  );
}

export default async function LadderLevelPage(props: { params: Promise<{ courseId: string; level: string }> }) {
  const params = await props.params;
  const level = Number.parseInt(params.level, 10);
  return <LadderRunnerClient courseId={params.courseId} level={Number.isNaN(level) ? 0 : level} />;
}
