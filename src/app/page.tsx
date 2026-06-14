'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Flame, ArrowRight, Target } from 'lucide-react';
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">IBLearn</h1>
        <p className="text-gray-500 dark:text-gray-400">{subjects.length} subjects · {subjects.reduce((s, sub) => s + sub.topics.length, 0)} topics · Study notes, flashcards & quizzes</p>
      </div>

      {userProgress.currentStreakDays > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-full text-sm font-semibold mb-6"
        >
          <Flame className="w-4 h-4" /> {userProgress.currentStreakDays} day{userProgress.currentStreakDays !== 1 ? 's' : ''}
        </motion.div>
      )}

      {weakTopics.length > 0 && (
        <div className="card p-4 mb-6 bg-orange-50/50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900">
          <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2 inline-flex items-center gap-1.5">
            <Target className="w-4 h-4" /> Needs Practice
          </h2>
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
              Practice all weak areas in mixed review <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Subjects</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {subjects.map((subject, idx) => {
          const subjectProgress = topicProgress.filter(tp => tp.subjectId === subject.id && tp.attempts.length > 0);
          const avgScore = subjectProgress.length > 0
            ? subjectProgress.reduce((s, tp) => s + getRecentAverageScore(tp.attempts), 0) / subjectProgress.length
            : 0;
          const stars = avgScore >= 0.9 ? 3 : avgScore >= 0.7 ? 2 : avgScore >= 0.4 ? 1 : 0;

          return (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
            >
              <Link href={`/subjects/${subject.id}`}
                className="card p-4 h-full block hover:shadow-md transition-shadow active:scale-[0.98] group"
                style={{ borderTopWidth: 4, borderTopColor: subject.accentColor }}
              >
                <span className="text-2xl mb-1 block">{subject.id === 'math' ? '📐' : subject.id === 'english' ? '📖' : subject.id === 'biology' ? '🌿' : subject.id === 'chemistry' ? '🧪' : '⚛️'}</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-50">{subject.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{subject.topics.length} topics</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`text-sm ${i < stars ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
                        {i < stars ? '★' : '☆'}
                      </span>
                    ))}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
