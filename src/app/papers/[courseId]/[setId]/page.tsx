import { getAllPapers, getPaper } from '@/content/registry';
import PaperRunnerClient from './PaperRunnerClient';

export function generateStaticParams() {
  return getAllPapers().map((paper) => ({ courseId: paper.courseId, setId: paper.id }));
}

export default async function PaperPage(props: { params: Promise<{ courseId: string; setId: string }> }) {
  const params = await props.params;
  const paper = getPaper(params.courseId, params.setId);
  if (!paper) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Paper not found.</div>;
  }
  return <PaperRunnerClient paper={paper} />;
}
