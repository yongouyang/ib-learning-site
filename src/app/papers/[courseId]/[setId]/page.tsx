import type { Metadata } from 'next';
import { getAllPapers, getPaper } from '@/content/registry';
import { metaForPaperSet } from '@/lib/seo/assessments';
import PaperRunnerClient from './PaperRunnerClient';

export function generateStaticParams() {
  return getAllPapers().map((paper) => ({ courseId: paper.courseId, setId: paper.id }));
}

/** Set 1 per course is free → indexable; sets 2+ are premium → noindex, follow (§1.2). */
export async function generateMetadata(props: {
  params: Promise<{ courseId: string; setId: string }>;
}): Promise<Metadata> {
  const { courseId, setId } = await props.params;
  const paper = getPaper(courseId, setId);
  return paper ? metaForPaperSet(paper) : {};
}

export default async function PaperPage(props: { params: Promise<{ courseId: string; setId: string }> }) {
  const params = await props.params;
  const paper = getPaper(params.courseId, params.setId);
  if (!paper) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Paper not found.</div>;
  }
  return <PaperRunnerClient paper={paper} />;
}
