import { getExamCourses } from '@/lib/exams';
import ExamRunnerClient from './ExamRunnerClient';

export function generateStaticParams() {
  return getExamCourses().flatMap((course) =>
    course.papers.map((paper) => ({ courseId: course.id, paperId: paper.paperId }))
  );
}

export default async function ExamPage(props: { params: Promise<{ courseId: string; paperId: string }> }) {
  const params = await props.params;
  return <ExamRunnerClient courseId={params.courseId} paperId={params.paperId} />;
}
