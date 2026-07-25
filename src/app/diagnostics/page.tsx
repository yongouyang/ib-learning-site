import Link from 'next/link';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { getDiagnosticCourses } from '@/lib/diagnostics';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function DiagnosticsPage() {
  const courses = getDiagnosticCourses();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Diagnostics' }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Diagnostic Tests</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Short cross-topic tests that find your weak areas — one question per topic, easy to hard.
          Your results go straight into the weak-areas system so practice is targeted from day one.
        </p>
      </div>

      <div className="grid gap-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/diagnostics/${course.id}`}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow active:scale-[0.99] group"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-gray-900 dark:text-gray-50">{course.title}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {course.questionCount} questions · {course.topicCount} topics
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
