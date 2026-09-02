import type { Metadata } from 'next';
import { getDiagnosticCourses } from '@/lib/diagnostics';
import { metaForDiagnostic } from '@/lib/seo/assessments';
import DiagnosticRunnerClient from './DiagnosticRunnerClient';

export function generateStaticParams() {
  return getDiagnosticCourses().map((course) => ({ courseId: course.id }));
}

// Free tier-0 surface → indexable. Title/canonical derive from the course's own tier
// qualifier so /diagnostics/math-y7 says "KS3 Year 7 Maths" exactly like its topics do.
export async function generateMetadata(props: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await props.params;
  return metaForDiagnostic(courseId) ?? {};
}

export default async function DiagnosticPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  return <DiagnosticRunnerClient courseId={params.courseId} />;
}
