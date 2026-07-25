import Link from 'next/link';
import { FileText, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { getExamCourses, examId } from '@/lib/exams';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import PaperScore from './PaperScore';

export default function ExamsPage() {
  const courses = getExamCourses();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Mock Exams' }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Mock Exams</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Timed practice papers — one countdown for the whole paper, unanswered questions
          count as incorrect when time runs out. All papers are non-calculator.
        </p>
      </div>

      <div className="grid gap-3">
        {courses.map((course) => (
          <div key={course.id} className="card p-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-50 mb-3">{course.title}</h2>
            <div className="space-y-2">
              {course.papers.map((paper) => (
                <Link
                  key={paper.paperId}
                  href={`/exams/${course.id}/${paper.paperId}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-50">{paper.title}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />
                      {paper.durationMinutes} min · 20 questions
                    </span>
                  </span>
                  <PaperScore examId={examId(course.id, paper.paperId)} />
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Link
                href={`/exams/${course.id}/ladder`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <TrendingUp className="w-4 h-4" /> Revision Ladder — 5 levels
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
