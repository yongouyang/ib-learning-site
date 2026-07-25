import { getDiagnosticCourses } from '@/lib/diagnostics';
import DiagnosticRunnerClient from './DiagnosticRunnerClient';

export function generateStaticParams() {
  return getDiagnosticCourses().map((course) => ({ courseId: course.id }));
}

export default async function DiagnosticPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  return <DiagnosticRunnerClient courseId={params.courseId} />;
}
