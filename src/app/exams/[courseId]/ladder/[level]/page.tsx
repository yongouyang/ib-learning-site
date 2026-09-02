import { COURSES } from '@/lib/courses';
import type { Metadata } from 'next';
import { LADDER_LEVELS } from '@/lib/ladder';
import { metaForLadderLevel } from '@/lib/seo/assessments';
import LadderRunnerClient from './LadderRunnerClient';

export function generateStaticParams() {
  return COURSES.flatMap((course) =>
    LADDER_LEVELS.map((level) => ({ courseId: course.id, level: String(level.level) }))
  );
}

/**
 * Levels 1–2 are free → indexable; 3–5 are premium → noindex, follow. Which side a level
 * falls on is read from isFreeLadderLevel() inside metaForLadderLevel, so the SEO layer
 * cannot drift from the entitlement policy.
 */
export async function generateMetadata(props: {
  params: Promise<{ courseId: string; level: string }>;
}): Promise<Metadata> {
  const { courseId, level } = await props.params;
  return metaForLadderLevel(courseId, Number.parseInt(level, 10)) ?? {};
}

export default async function LadderLevelPage(props: { params: Promise<{ courseId: string; level: string }> }) {
  const params = await props.params;
  const level = Number.parseInt(params.level, 10);
  return <LadderRunnerClient courseId={params.courseId} level={Number.isNaN(level) ? 0 : level} />;
}
