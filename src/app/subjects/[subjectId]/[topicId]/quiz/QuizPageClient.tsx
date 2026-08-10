'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSubject, getTopic } from '@/content/registry';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import type { QuestionResult, SubjectId } from '@/content/types';
import {
  DIFFICULTY_LEVELS,
  filterQuestionsByDifficulty,
  hasVariantGroups,
  orderQuestionsByDifficulty,
  parseDifficultyFilter,
  sampleVariantGroups,
  type DifficultyFilter,
} from '@/lib/quiz-utils';
import { materializeTemplates } from '@/lib/generators';

interface QuizPageClientProps {
  subjectId: string;
  topicId: string;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2);
}

export default function QuizPageClient({ subjectId, topicId }: QuizPageClientProps) {
  const searchParams = useSearchParams();
  const difficulty = parseDifficultyFilter(searchParams.get('difficulty'));
  const topic = getTopic(subjectId as SubjectId, topicId);
  const subject = getSubject(subjectId as SubjectId);
  const { recordAttempt } = useProgress();
  // Per-question outcomes for the current session, flushed into recordAttempt
  // on completion (feeds variant-group mastery in src/lib/mastery.ts).
  const resultsRef = useRef<QuestionResult[]>([]);

  // Templates make a topic grouped even without authored variantOf groups —
  // each template instance occupies a group slot (its variantOf, or solo).
  const grouped = topic
    ? hasVariantGroups(topic.questions) || (topic.templates?.length ?? 0) > 0
    : false;

  // Session seed: deterministic during SSR/first render (hydration-safe), then
  // reseeded client-side on mount for grouped topics so every visit — and every
  // "new question set" — samples fresh variants (docs/question-variations-plan.md).
  const [sessionSeed, setSessionSeed] = useState(`${topicId}:${difficulty}`);
  useEffect(() => {
    if (grouped) setSessionSeed(`${topicId}:${difficulty}:${randomSeed()}`);
  }, [grouped, topicId, difficulty]);

  const handleNewSet = () => {
    resultsRef.current = [];
    setSessionSeed(`${topicId}:${difficulty}:${randomSeed()}`);
  };

  if (!topic) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Topic not found.</div>;

  // Authored questions plus one materialized instance per template (seeded by
  // sessionSeed, so "new question set" redraws fresh values). Difficulty chip
  // counts below intentionally cover authored questions only.
  const pool = [...topic.questions, ...materializeTemplates(topic, sessionSeed)];
  const filtered = filterQuestionsByDifficulty(pool, difficulty);
  // Grouped topics: one question per variant group (~10 per session). Topics
  // without groups keep the legacy behavior — every question, every session.
  const sessionQuestions = grouped ? sampleVariantGroups(filtered, sessionSeed) : filtered;
  // Easy -> hard with a deterministic intra-band shuffle; QuizGame receives the
  // final order (no shuffleSeed), and keying on filter+seed forces a remount
  // when the user switches difficulty or requests a new set.
  const ordered = orderQuestionsByDifficulty(sessionQuestions, sessionSeed);

  const filters: { key: DifficultyFilter; label: string }[] = [
    { key: 'all', label: `All (${topic.questions.length})` },
    ...DIFFICULTY_LEVELS.map((level) => ({
      key: level as DifficultyFilter,
      label: `${level[0].toUpperCase()}${level.slice(1)} (${
        topic.questions.filter((q) => (q.difficulty ?? 'medium') === level).length
      })`,
    })),
  ];

  const quizHref = (key: DifficultyFilter) =>
    key === 'all'
      ? `/subjects/${subjectId}/${topicId}/quiz`
      : `/subjects/${subjectId}/${topicId}/quiz?difficulty=${key}`;

  return (
    <div>
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex gap-2" role="group" aria-label="Filter by difficulty">
          {filters.map((f) => {
            const active = difficulty === f.key;
            return (
              <Link
                key={f.key}
                href={quizHref(f.key)}
                aria-pressed={active}
                className={`flex-1 inline-flex items-center justify-center py-2 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>
      <QuizGame
        key={`${difficulty}:${sessionSeed}`}
        questions={ordered}
        backHref={`/subjects/${subjectId}`}
        backLabel="Back to Topics"
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: `/subjects/${subjectId}`, label: subject?.name ?? subjectId },
          { href: `/subjects/${subjectId}/${topicId}/study`, label: topic.title },
          { label: 'Quiz' },
        ]}
        enableTimer={true}
        timerSeconds={60}
        onQuestionResult={(questionId, correct) => {
          resultsRef.current.push({ questionId, correct });
        }}
        onComplete={(correctCount, totalCount) => {
          recordAttempt(topicId, subjectId as SubjectId, topic.title, subjectId, correctCount, totalCount, resultsRef.current);
          resultsRef.current = [];
        }}
        onNewSet={grouped ? handleNewSet : undefined}
      />
    </div>
  );
}
