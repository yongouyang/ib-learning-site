import Link from 'next/link';
import { FileSignature, Clock, ArrowRight } from 'lucide-react';
import { getAllPapers } from '@/content/registry';
import { getCourse } from '@/lib/courses';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import { splitPaperSetsByAccess } from '@/lib/entitlements/exam-access';
import type { Paper } from '@/content/types';
import PaperScore from '@/app/exams/PaperScore';

function SetRow({ paper }: { paper: Paper }) {
  const totalMarks = paper.questions.reduce((sum, q) => sum + q.marks, 0);
  return (
    <Link
      href={`/papers/${paper.courseId}/${paper.id}`}
      className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
    >
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 shrink-0">
        <FileSignature className="w-4 h-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-50">{paper.title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {paper.durationMinutes && (
            <>
              <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />
              {paper.durationMinutes} min ·{' '}
            </>
          )}
          {paper.questions.length} questions · {totalMarks} marks
        </span>
      </span>
      <PaperScore examId={paper.id} />
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
    </Link>
  );
}

export default function PapersPage() {
  const papers = getAllPapers();
  const byCourse = new Map<string, typeof papers>();
  for (const paper of papers) {
    const list = byCourse.get(paper.courseId) ?? [];
    list.push(paper);
    byCourse.set(paper.courseId, list);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Practice Papers' }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Practice Papers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Past-paper-style free-response sets — write your answer, check the model answer,
          then mark yourself against the markscheme. All sets are non-calculator and use
          original questions.
        </p>
      </div>

      {/* Phase E3 — ONE page-level premium pitch (copy voice: say it once);
          each course card below only carries a compact lock row. */}
      <div className="mb-6">
        <LockedFeature
          feature="exam-sets-full"
          title="Full exam sets"
          benefit="Set 1 of every course is free. Premium unlocks every set, timed mock mode and upper ladder levels."
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {papers.length} free-response sets across {byCourse.size} courses — Set 1 of each course is free
          </p>
        </LockedFeature>
      </div>

      <div className="grid gap-3">
        {Array.from(byCourse.entries()).map(([courseId, coursePapers]) => {
          const course = getCourse(courseId);
          // Phase E3 — "first set per course free" (entitlement-policy §Tier 2);
          // later sets stay visible behind the premium tease.
          const { free, locked } = splitPaperSetsByAccess(coursePapers);
          return (
            <div key={courseId} className="card p-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-3">{course?.title ?? courseId}</h2>
              <div className="space-y-2">
                {free.map((paper) => <SetRow key={paper.id} paper={paper} />)}
              </div>
              {locked.length > 0 && (
                <LockedFeature
                  feature="exam-sets-full"
                  title="Full exam sets"
                  benefit={`Set 1 is free — unlock all ${free.length + locked.length} sets for this course, upper ladder levels and timed mock mode.`}
                  compact
                >
                  <div className="space-y-2 mt-2">
                    {locked.map((paper) => <SetRow key={paper.id} paper={paper} />)}
                  </div>
                </LockedFeature>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
