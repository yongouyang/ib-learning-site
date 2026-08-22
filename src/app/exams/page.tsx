import Link from 'next/link';
import { FileText, FileSignature, Clock, ArrowRight, TrendingUp, ClipboardList } from 'lucide-react';
import { getExamCourses, examId } from '@/lib/exams';
import { getPapersForCourse } from '@/content/registry';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CtaLink } from '@/components/CtaLink';
import PaperScore from './PaperScore';

export default function ExamsPage() {
  const courses = getExamCourses();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Mock Exams' }]} currentAsHeading />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Timed practice papers — one countdown for the whole paper, unanswered questions
        count as incorrect when time runs out. All papers are non-calculator.
      </p>

      {/* Cross-link to Diagnostics — natural pair: diagnose weak areas → practice with exams.
          Stacked layout mirrors the home "Not sure where to start?" card (icon + heading +
          subtext + link) so it never cramps on narrow phones. */}
      <div className="card p-4 mb-6 bg-blue-50/50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
            <ClipboardList className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Diagnose before you practise.</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              A short diagnostic pinpoints your weak areas, so you target exactly what needs work.
            </p>
            <CtaLink
              ctaId="exams_to_diagnostics"
              href="/diagnostics"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
            >
              Start with a free diagnostic <ArrowRight className="w-4 h-4" />
            </CtaLink>
          </div>
        </div>
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
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-4 gap-y-1.5">
              <Link
                href={`/exams/${course.id}/ladder`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <TrendingUp className="w-4 h-4" /> Revision Ladder — 5 levels
              </Link>
              {getPapersForCourse(course.id).map((set) => (
                <Link
                  key={set.id}
                  href={`/papers/${set.courseId}/${set.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200"
                >
                  <FileSignature className="w-4 h-4" /> {set.title} — free-response
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
