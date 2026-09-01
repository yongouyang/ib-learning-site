import type { Metadata } from 'next';
import { getExamCourses } from '@/lib/exams';
import { metaForMockPaper } from '@/lib/seo/assessments';
import ExamRunnerClient from './ExamRunnerClient';

export function generateStaticParams() {
  return getExamCourses().flatMap((course) =>
    course.papers.map((paper) => ({ courseId: course.id, paperId: paper.paperId }))
  );
}

/**
 * noindex, follow: the timed mock runner is Premium-gated (`has('exam-sets-full')`) so an
 * anonymous crawler meets a LockedFeature wall here. Still crawlable — the links have to be
 * followed for equity to reach the free ladder and the topics, and noindex is only readable
 * on a fetched page. Deliberately absent from the sitemap too.
 */
export async function generateMetadata(props: {
  params: Promise<{ courseId: string; paperId: string }>;
}): Promise<Metadata> {
  const { courseId, paperId } = await props.params;
  return metaForMockPaper(courseId, paperId) ?? {};
}

export default async function ExamPage(props: { params: Promise<{ courseId: string; paperId: string }> }) {
  const params = await props.params;
  return <ExamRunnerClient courseId={params.courseId} paperId={params.paperId} />;
}
