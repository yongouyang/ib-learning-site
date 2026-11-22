'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Star, Flame, CheckCircle2, Target, Dices, ClipboardList, FileText, FileSignature, BookMarked, ChevronRight } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { getAllPapers, getSubjects } from '@/content/registry';
import type { Stage, TopicMeta, TopicProgress } from '@/content/types';
import { getCourse } from '@/lib/courses';
import { getRecentAverageScore } from '@/lib/progress-store';
import { getCardStats } from '@/lib/flashcard-scheduler';
import { groupTopicsByStage } from '@/lib/topic-groups';
import DualRingDonut from '@/components/DualRingDonut';
import InlineMath from '@/components/InlineMath';
import { InstallAppButton } from '@/components/InstallAppButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { subjectEmoji } from '@/lib/subject-emoji';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'ks3', label: 'KS3' },
  { id: 'igcse', label: 'IGCSE' },
  { id: 'dp', label: 'IB DP' },
];

function summariseTopics(topics: TopicMeta[], progressByTopic: Map<string, TopicProgress>) {
  const attempted = topics.flatMap((topic) => {
    const progress = progressByTopic.get(topic.id);
    return progress && progress.attempts.length > 0 ? [progress] : [];
  });
  return {
    completed: attempted.length,
    total: topics.length,
    averageScore: attempted.length > 0
      ? attempted.reduce((sum, progress) => sum + getRecentAverageScore(progress.attempts), 0) / attempted.length
      : null,
  };
}

function averageLabel(averageScore: number | null): string {
  return averageScore === null ? 'No attempts' : `${Math.round(averageScore * 100)}% average`;
}

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
  const [stageFilter, setStageFilter] = useState<Stage | null>(null);
  const subjects = getSubjects();
  const progressByTopic = new Map(topicProgress.map((progress) => [progress.topicId, progress]));
  const stageSummaries = STAGES.map((stage) => ({
    ...stage,
    ...summariseTopics(
      subjects.flatMap((subject) => subject.topics).filter((topic) => topic.stage === stage.id),
      progressByTopic,
    ),
  }));
  const visibleSubjects = subjects.flatMap((subject) => {
    const topics = stageFilter ? subject.topics.filter((topic) => topic.stage === stageFilter) : subject.topics;
    return topics.length > 0 ? [{ ...subject, topics }] : [];
  });
  const selectedStageLabel = STAGES.find((stage) => stage.id === stageFilter)?.label;

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
          <div className="text-xs text-gray-500 dark:text-gray-400">Topics Started</div>
        </div>
      </div>

      <section className="mb-6" aria-labelledby="stage-progress-heading">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 id="stage-progress-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-50">Progress by stage</h2>
          {stageFilter && (
            <button
              type="button"
              onClick={() => setStageFilter(null)}
              className="min-h-11 rounded-xl px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              Show all stages
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Select a stage to focus the subject list.</p>
        <div className="grid grid-cols-3 gap-2">
          {stageSummaries.map((stage) => {
            const selected = stageFilter === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setStageFilter((current) => current === stage.id ? null : stage.id)}
                className={`card pressable min-h-28 p-3 text-left ${selected
                  ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400'
                  : 'hover:border-gray-300 dark:hover:border-gray-600'}`}
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">{stage.label}</span>
                <span className="mt-1 block text-xl font-black text-gray-900 dark:text-gray-50">
                  {stage.completed}<span className="text-sm font-medium text-gray-500 dark:text-gray-400">/{stage.total}</span>
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">topics started</span>
                <span className="mt-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{averageLabel(stage.averageScore)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="subject-progress-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="subject-progress-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {selectedStageLabel ? `${selectedStageLabel} subjects` : 'Subjects'}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{visibleSubjects.length} {visibleSubjects.length === 1 ? 'subject' : 'subjects'}</span>
        </div>
        <p className="sr-only" aria-live="polite">
          {selectedStageLabel ? `Showing ${visibleSubjects.length} subjects with ${selectedStageLabel} topics.` : 'Showing all subjects.'}
        </p>
        {visibleSubjects.map((subject) => {
          const summary = summariseTopics(subject.topics, progressByTopic);
          const cardStats = subject.topics.reduce(
            (acc, topic) => {
              const stats = getCardStats(topic.flashcardIds, flashcardProgress);
              return { seen: acc.seen + stats.seen, known: acc.known + stats.known, total: acc.total + stats.total };
            },
            { seen: 0, known: 0, total: 0 }
          );

          return (
            <details
              key={`${subject.id}:${stageFilter ?? 'all'}`}
              data-subject-progress={subject.id}
              className="card group/subject mb-3 border-l-4"
              style={{ borderLeftColor: subject.accentColor }}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-50">
                    <span aria-hidden="true">{subjectEmoji(subject.id)}</span>
                    <span>{subject.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {summary.completed}/{summary.total} topics started · {averageLabel(summary.averageScore)}
                  </div>
                </div>
                <div className="w-16 shrink-0 text-center">
                  <DualRingDonut seen={cardStats.seen} known={cardStats.known} total={cardStats.total} size={36} />
                  <span className="mt-1 block text-[10px] leading-3 text-gray-500 dark:text-gray-400">Flashcards known</span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open/subject:rotate-90 dark:text-gray-500" aria-hidden="true" />
              </summary>
              <div className="px-4 pb-4">
                {groupTopicsByStage(subject.topics).map((group) => {
                  const groupSummary = summariseTopics(group.topics, progressByTopic);
                  return (
                    <details
                      key={group.key}
                      data-topic-group={group.key}
                      className="group/stage mt-3 rounded-xl border border-gray-100 first:mt-0 dark:border-gray-800"
                    >
                      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open/stage:rotate-90 dark:text-gray-500" aria-hidden="true" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{group.label}</h3>
                        <span className="ml-auto pl-2 text-xs text-gray-500 dark:text-gray-400">
                          {groupSummary.completed}/{groupSummary.total} started · {averageLabel(groupSummary.averageScore)}
                        </span>
                      </summary>
                      <div className="space-y-1 px-1 pb-2">
                        {group.topics.map((topic) => {
                          const progress = progressByTopic.get(topic.id);
                          const score = progress && progress.attempts.length > 0 ? getRecentAverageScore(progress.attempts) : -1;
                          return (
                            <Link
                              key={topic.id}
                              href={`/subjects/${subject.id}/${topic.id}/quiz`}
                              className="pressable flex min-h-11 items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${score >= 0 ? '' : 'bg-gray-300 dark:bg-gray-600'}`}
                                style={score >= 0 ? { backgroundColor: subject.accentColor } : undefined}
                              />
                              <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-300">{topic.title}</span>
                              {score >= 0 ? (
                                <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{Math.round(score * 100)}%</span>
                              ) : (
                                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">Not started</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </section>

      <section className="card mt-6 p-4" aria-labelledby="practice-heading">
        <h2 id="practice-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Practice</h2>
        <div className="grid gap-2 sm:grid-cols-2">
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
      </section>

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
