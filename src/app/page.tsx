'use client';

import Link from 'next/link';
import { useProgress } from '@/context/ProgressContext';
import { getSubjects, subjectMeta } from '@/content/registry';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import { getRecentAverageScore } from '@/lib/progress-store';

export default function HomePage() {
  const { userProgress, topicProgress } = useProgress();
  const subjects = getSubjects();
  const weakTopics = getWeakTopics(topicProgress);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">IBLearn</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subjects.length} subjects · {subjects.reduce((s, sub) => s + sub.topics.length, 0)} topics</p>
        </div>
        {userProgress.currentStreakDays > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-full text-sm font-semibold">
            🔥 {userProgress.currentStreakDays} day{userProgress.currentStreakDays !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {weakTopics.length > 0 && (
        <div className="card p-4 mb-6 bg-orange-50/50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900">
          <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">Needs Practice</h2>
          <div className="space-y-1.5">
            {weakTopics.slice(0, 3).map((tp) => {
              const meta = subjectMeta[tp.subjectId];
              return (
                <Link key={`${tp.subjectId}:${tp.topicId}`} href={`/subjects/${tp.subjectId}/${tp.topicId}/quiz`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 py-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="flex-1">{tp.topicTitle}</span>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{Math.round(getRecentAverageScore(tp.attempts) * 100)}%</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-orange-200/60 dark:border-orange-900/60">
            <Link href="/mixed-review?mode=weak"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200">
              🎯 Practice all weak areas in mixed review →
            </Link>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Subjects</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {subjects.map((subject) => {
          const subjectProgress = topicProgress.filter(tp => tp.subjectId === subject.id && tp.attempts.length > 0);
          const avgScore = subjectProgress.length > 0
            ? subjectProgress.reduce((s, tp) => s + getRecentAverageScore(tp.attempts), 0) / subjectProgress.length
            : 0;
          const stars = avgScore >= 0.9 ? 3 : avgScore >= 0.7 ? 2 : avgScore >= 0.4 ? 1 : 0;

          return (
            <Link key={subject.id} href={`/subjects/${subject.id}`}
              className="card p-4 hover:shadow-md transition-shadow active:scale-[0.98]">
              <span className="text-2xl mb-1 block">{subject.id === 'math' ? '📐' : subject.id === 'english' ? '📖' : subject.id === 'biology' ? '🌿' : subject.id === 'chemistry' ? '🧪' : '⚛️'}</span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-50">{subject.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{subject.topics.length} topics</p>
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`text-sm ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
                    {i < stars ? '★' : '☆'}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
