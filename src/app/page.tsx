'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Flame, ArrowRight, Target, Layers, Trophy, Compass, Repeat, Award } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { getSubjects, subjectMeta } from '@/content/registry';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import { getRecentAverageScore } from '@/lib/progress-store';
import { getDueTopics } from '@/lib/flashcard-scheduler';
import { getNextAction } from '@/lib/home-next-action';
import { Hero } from '@/components/Hero';

// "Why Octav Learning" — the three steps of the journey, each emphasising its
// value. First-time visitors only: returning students already know the loop.
const steps = [
  {
    icon: Compass,
    tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    title: 'Diagnose',
    body: 'A short test pinpoints your weak spots, so you start in the right place — not from scratch.',
  },
  {
    icon: Repeat,
    tone: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    title: 'Practise',
    body: 'Illustrated notes, smart flashcards and quizzes build understanding that sticks — in a few minutes a day.',
  },
  {
    icon: Award,
    tone: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    title: 'Perform',
    body: 'Timed mocks and AI-marked papers prove you\u2019re exam-ready, with progress you can watch climb.',
  },
];

export default function HomePage() {
  const { userProgress, topicProgress, flashcardProgress, loaded } = useProgress();
  const subjects = getSubjects();
  const weakTopics = getWeakTopics(topicProgress);
  const dueTopics = getDueTopics(subjects.flatMap((s) => s.topics), flashcardProgress);
  const totalDue = dueTopics.reduce((sum, t) => sum + t.dueCount, 0);

  // Returning = has any prior study activity (quiz/exam/ladder/flashcard).
  // Deliberately NOT auth-based: when registration lands, a logged-in user with
  // no activity should still see onboarding, so "has activity" stays the signal.
  const isReturning = loaded && userProgress.lastStudyDate !== null;
  const nextAction = getNextAction(dueTopics, topicProgress);
  // Returning user with everything mastered — positive empty state.
  const isAllCaughtUp = loaded && topicProgress.length > 0 && weakTopics.length === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Hero isReturning={isReturning} nextAction={nextAction} />

      {/* Why Octav Learning — three steps, first-time visitors only. */}
      {!isReturning && (
        <section aria-label="Why Octav Learning" className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Why Octav Learning</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="card p-4">
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 shrink-0 ${step.tone}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{step.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dashboard — returning-user cards. */}
      <h2 className="sr-only">Your practice</h2>

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
          <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2 inline-flex items-center gap-1.5">
            <Target className="w-4 h-4" aria-hidden="true" /> Needs Practice
          </h3>
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
              Practise all weak areas in mixed review <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {dueTopics.length > 0 && (
        <div className="card p-4 mb-6 bg-green-50/50 dark:bg-green-950/50 border-green-200 dark:border-green-900">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4" aria-hidden="true" /> {totalDue} flashcard{totalDue !== 1 ? 's' : ''} due for review
          </h3>
          <div className="space-y-1.5">
            {dueTopics.slice(0, 3).map((t) => {
              const meta = subjectMeta[t.subjectId];
              return (
                <Link key={`${t.subjectId}:${t.topicId}`} href={`/subjects/${t.subjectId}/${t.topicId}/flashcards?filter=due`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 py-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="flex-1">{t.topicTitle}</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">{t.dueCount} due</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isAllCaughtUp && (
        <div className="card p-4 mb-6 bg-green-50/50 dark:bg-green-950/50 border-green-200 dark:border-green-900">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1 inline-flex items-center gap-1.5">
            <Trophy className="w-4 h-4" aria-hidden="true" /> All caught up!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            No weak topics right now. Try a timed mock exam or explore a new subject.
          </p>
          <Link href="/exams"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200">
            Test yourself under timed conditions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <h2 id="subjects" className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Subjects</h2>
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
                <span className="text-2xl mb-1 block" aria-hidden="true">{subject.id === 'math' ? '📐' : subject.id === 'english' ? '📖' : subject.id === 'biology' ? '🌿' : subject.id === 'chemistry' ? '🧪' : '⚛️'}</span>
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
