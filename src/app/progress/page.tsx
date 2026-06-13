'use client';

import Link from 'next/link';
import { useProgress } from '@/context/ProgressContext';
import { getSubjects } from '@/content/registry';
import { getRecentAverageScore } from '@/lib/progress-store';

export default function ProgressPage() {
  const { userProgress, topicProgress } = useProgress();
  const subjects = getSubjects();

  const attemptedTopics = new Set(topicProgress.filter(tp => tp.attempts.length > 0).map(tp => tp.topicId)).size;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">My Progress</h1>

      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">⭐</div>
          <div className="text-xl font-black text-gray-900 dark:text-gray-50">{userProgress.totalStars}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Stars</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-xl font-black text-gray-900 dark:text-gray-50">{userProgress.currentStreakDays}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Day Streak</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <div className="text-xl font-black text-gray-900 dark:text-gray-50">{attemptedTopics}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Topics Done</div>
        </div>
      </div>

      {/* Mixed review actions */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">Practice</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/mixed-review?mode=weak"
            className="flex-1 text-center py-2.5 rounded-lg bg-orange-600 text-white font-medium text-sm hover:bg-orange-700 transition-colors">
            🎯 Practice Weak Areas
          </Link>
          <Link href="/mixed-review"
            className="flex-1 text-center py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
            🎲 Mixed Review
          </Link>
        </div>
      </div>

      {/* Per subject */}
      {subjects.map((subject) => {
        const subjectProgress = topicProgress.filter(tp => tp.subjectId === subject.id && tp.attempts.length > 0);
        const completed = subjectProgress.length;
        const avgScore = completed > 0
          ? subjectProgress.reduce((s, tp) => s + getRecentAverageScore(tp.attempts), 0) / completed
          : 0;

        return (
          <div key={subject.id} className="card p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>{subject.id === 'math' ? '📐' : subject.id === 'english' ? '📖' : subject.id === 'biology' ? '🌿' : subject.id === 'chemistry' ? '🧪' : '⚛️'}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-50">{subject.name}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{completed}/{subject.topics.length} topics</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${avgScore * 100}%`, backgroundColor: subject.accentColor }} />
            </div>
            <div className="space-y-1">
              {subject.topics.map((topic) => {
                const tp = subjectProgress.find(t => t.topicId === topic.id);
                const score = tp ? getRecentAverageScore(tp.attempts) : -1;
                return (
                  <Link key={topic.id} href={`/subjects/${subject.id}/${topic.id}/quiz`}
                    className="flex items-center gap-2 text-sm py-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${score >= 0 ? '' : 'bg-gray-300 dark:bg-gray-600'}`}
                      style={score >= 0 ? { backgroundColor: subject.accentColor } : undefined} />
                    <span className="flex-1 text-gray-700 dark:text-gray-300">{topic.title}</span>
                    {score >= 0 ? (
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{Math.round(score * 100)}%</span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Not started</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
