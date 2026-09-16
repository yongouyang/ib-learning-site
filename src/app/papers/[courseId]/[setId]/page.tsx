import type { Metadata } from 'next';
import { getAllPapers, getPaper } from '@/content/registry';
import { getPaperContent } from '@/content/registry.papers';
import { metaForPaperSet } from '@/lib/seo/assessments';
import { isFreePaperSet } from '@/lib/entitlements/exam-access';
import PaperRunnerClient from './PaperRunnerClient';
import PremiumPaperShell from './PremiumPaperShell';

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
  const meta = getPaper(params.courseId, params.setId);
  if (!meta) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Paper not found.</div>;
  }

  // Phase 1b (docs/premium-content-protection-plan.md §4.2): a PREMIUM set's questions and mark
  // schemes are no longer in the build at all — the shell fetches them from the gated content API.
  // Only this free-set branch imports the paper content, and only the free set's paper is passed as a
  // prop, so nothing premium is serialised into the HTML or the RSC payload.
  if (!isFreePaperSet(meta.id)) {
    return <PremiumPaperShell courseId={params.courseId} setId={params.setId} meta={meta} />;
  }

  const paper = getPaperContent(params.courseId, params.setId);
  if (!paper) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Paper not found.</div>;
  }
  return <PaperRunnerClient paper={paper} />;
}
