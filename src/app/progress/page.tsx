'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, Flame, CheckCircle2, Target, Dices, ClipboardList, FileText, FileSignature, BookMarked, ChevronRight } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { getAllPapers, getSubjects } from '@/content/registry';
import { getCourse } from '@/lib/courses';
import { getRecentAverageScore } from '@/lib/progress-store';
import { getCardStats } from '@/lib/flashcard-scheduler';
import DualRingDonut from '@/components/DualRingDonut';
import InlineMath from '@/components/InlineMath';
import { InstallAppButton } from '@/components/InstallAppButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { subjectEmoji } from '@/lib/subject-emoji';

function examLabel(examId: string): string {
  if (examId === 'custom-mixed-exam') return 'Custom mixed exam · Year 7 maths';
  const paper = getAllPapers().find((item) => item.id === examId);
  if (paper) return `${getCourse(paper.courseId)?.title ?? paper.courseId} · ${paper.title}`;
  return examId;
}

function examDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;
}

export default function ProgressPage() {
  const { userProgress, topicProgress, flashcardProgress, examResults } = useProgress();
  const subjects = getSubjects();

  const attemptedTopics = new Set(topicProgress.filter(tp => tp.attempts.length > 0).map(tp => tp.topicId)).size;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'My Progress' }]} currentAsHeading />

      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <Star className="w-4 h-4 text-yellow-500 shrink-0" aria-hidden="true" />
            <span className="text-xl font-black text-gray-900 dark:text-gray-50">{userProgress.totalStars}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Stars</div>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <Flame className="w-4 h-4 text-orange-500 shrink-0" aria-hidden="true" />
            <span className="text-xl font-black text-gray-900 dark:text-gray-50">{userProgress.currentStreakDays}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Day Streak</div>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden="true" />
            <span className="text-xl font-black text-gray-900 dark:text-gray-50">{attemptedTopics}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Topics Done</div>
        </div>
      </div>

      {/* Mixed review actions */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">Practice</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <Link href="/mistakes"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors">
            <BookMarked className="w-4 h-4" /> Mistake Notebook
          </Link>
          <Link href="/custom-test?mode=weak"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-orange-700 text-white font-medium text-sm hover:bg-orange-800 transition-colors">
            <Target className="w-4 h-4" /> Practise Weak Areas
          </Link>
          <Link href="/mixed-review"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
            <Dices className="w-4 h-4" /> Mixed Review
          </Link>
          <Link href="/diagnostics"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
            <ClipboardList className="w-4 h-4" /> Diagnostics
          </Link>
          <Link href="/exams"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
            <FileText className="w-4 h-4" /> Mock Exams
          </Link>
          <Link href="/papers"
            className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
            <FileSignature className="w-4 h-4" /> Practice Papers
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
        // Flashcard Seen/Known across the subject's decks (Phase 6).
        const cardStats = subject.topics.reduce(
          (acc, topic) => {
            const stats = getCardStats(topic.flashcardIds, flashcardProgress);
            return { seen: acc.seen + stats.seen, known: acc.known + stats.known, total: acc.total + stats.total };
          },
          { seen: 0, known: 0, total: 0 }
        );

        return (
          <div key={subject.id} className="card p-4 mb-3 border-l-4" style={{ borderLeftColor: subject.accentColor }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>{subjectEmoji(subject.id)}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-50">{subject.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{completed}/{subject.topics.length} topics</span>
                <DualRingDonut seen={cardStats.seen} known={cardStats.known} total={cardStats.total} size={36} />
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${avgScore * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: subject.accentColor }}
              />
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

      {examResults.length > 0 && (
        <section className="mt-6" aria-labelledby="exam-history-heading">
          <h2 id="exam-history-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">Exam history</h2>
          <div className="space-y-3">
            {examResults.slice(-5).reverse().map((result, index) => (
              <details key={`${result.examId}:${result.date}:${index}`} className="card p-4 group">
                <summary className="min-h-11 flex items-center cursor-pointer font-semibold text-gray-900 dark:text-gray-50">
                  <ChevronRight className="w-4 h-4 mr-2 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                  <span>{examLabel(result.examId)} · {result.correctCount}/{result.totalCount} marks</span>
                  <span className="ml-auto pl-3 text-xs font-normal text-gray-500 dark:text-gray-400">{new Date(result.date).toLocaleDateString('en-GB')} · {examDuration(result.secondsUsed)}</span>
                </summary>
                {result.questionResults ? (
                  <div className="mt-4 space-y-3">
                    {result.questionResults.map((outcome) => (
                      <article key={outcome.question.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-50"><InlineMath text={outcome.question.stem} /></h3>
                        <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{outcome.ticks.filter(Boolean).length}/{outcome.question.marks} marks</p>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><span className="font-semibold">Your answer: </span>{outcome.studentAnswer || '(no answer)'}</p>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Model answer: </span><InlineMath text={outcome.question.modelAnswer} /></p>
                        <ul className="mt-3 space-y-1">
                          {outcome.question.markscheme.map((point, pointIndex) => (
                            <li key={pointIndex} className={`text-sm ${outcome.ticks[pointIndex] ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                              {outcome.ticks[pointIndex] ? '✓' : '○'} <InlineMath text={point} />
                              {outcome.aiComments?.[pointIndex] && <span className="block pl-5 text-blue-700 dark:text-blue-300">AI: {outcome.aiComments[pointIndex]}</span>}
                            </li>
                          ))}
                        </ul>
                        {outcome.aiFeedback && <p className="mt-2 text-sm text-blue-700 dark:text-blue-300"><span className="font-semibold">AI feedback: </span>{outcome.aiFeedback}</p>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">This earlier exam recorded only its overall score.</p>
                )}
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Install entry point — renders only when the browser can install
          (or on iOS, where it shows manual instructions). */}
      <div className="mt-6 flex justify-center">
        <InstallAppButton />
      </div>
    </div>
  );
}
