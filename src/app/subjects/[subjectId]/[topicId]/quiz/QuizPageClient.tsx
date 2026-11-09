'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useProgress } from '@/context/ProgressContext';
import QuizGame from '@/components/QuizGame';
import type { Flashcard, Question, QuestionResult, SubjectId, TopicTemplate } from '@/content/types';
import {
  DIFFICULTY_LEVELS,
  filterQuestionsByDifficulty,
  groupKeyOf,
  hasVariantGroups,
  orderQuestionsByDifficulty,
  parseDifficultyFilter,
  randomSeed,
  sampleVariantGroups,
  type DifficultyFilter,
} from '@/lib/quiz-utils';
import { materializeTemplates } from '@/lib/generators';

/**
 * Phase 1a: authored questions and templates arrive from the server page, so the quiz no longer
 * pulls the whole content bank into a client chunk. Templates stay client-side because "New Question
 * Set" materialises fresh variants locally (src/lib/generators.ts is code, not content).
 */
interface QuizPageClientProps {
  subjectId: string;
  topicId: string;
  topicTitle: string;
  subjectName: string;
  questions: Question[];
  templates?: TopicTemplate[];
  /** Passed so a `source: "flashcards"` template can be fed the topic's own deck. */
  flashcards?: Flashcard[];
}

export default function QuizPageClient({
  subjectId,
  topicId,
  topicTitle,
  subjectName,
  questions,
  templates,
  flashcards,
}: QuizPageClientProps) {
  const searchParams = useSearchParams();
  const difficulty = parseDifficultyFilter(searchParams.get('difficulty'));
  const { recordAttempt } = useProgress();
  const resultsRef = useRef<QuestionResult[]>([]);

  // Templates make a topic grouped even without authored variantOf groups —
  // each template instance occupies a group slot (its variantOf, or solo).
  const grouped = hasVariantGroups(questions) || (templates?.length ?? 0) > 0;

  // Do not mount the initial deterministic grouped draw: its immediate reseed
  // would otherwise create two measurable attempts before the student answers.
  const [session, setSession] = useState<{ topicId: string; difficulty: DifficultyFilter; seed: string } | null>(
    grouped ? null : { topicId, difficulty, seed: `${topicId}:${difficulty}` }
  );
  const [similarGroups, setSimilarGroups] = useState<string[] | null>(null);
  useEffect(() => {
    setSession({
      topicId,
      difficulty,
      seed: grouped ? `${topicId}:${difficulty}:${randomSeed()}` : `${topicId}:${difficulty}`,
    });
  }, [grouped, topicId, difficulty]);

  const sessionReady = session?.topicId === topicId && session.difficulty === difficulty;
  const sessionSeed = sessionReady ? session.seed : `${topicId}:${difficulty}`;

  const handleNewSet = () => {
    resultsRef.current = [];
    setSimilarGroups(null);
    setSession({ topicId, difficulty, seed: `${topicId}:${difficulty}:${randomSeed()}` });
  };

  const handleSimilarQuestions = (mistakes: Question[]) => {
    resultsRef.current = [];
    setSimilarGroups([...new Set(mistakes.map(groupKeyOf))]);
    setSession({ topicId, difficulty, seed: `${topicId}:${difficulty}:similar:${randomSeed()}` });
  };

  const pool = [...questions, ...materializeTemplates({ id: topicId, templates, flashcards }, sessionSeed)];
  const filtered = filterQuestionsByDifficulty(pool, difficulty);
  const scoped = similarGroups ? filtered.filter((question) => similarGroups.includes(groupKeyOf(question))) : filtered;
  const groupSizes = new Map<string, number>();
  for (const question of pool) {
    const key = groupKeyOf(question);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }
  const canOfferSimilar = grouped || [...groupSizes.values()].some((size) => size > 1);
  const sessionQuestions = grouped || similarGroups ? sampleVariantGroups(scoped, sessionSeed) : scoped;
  const ordered = orderQuestionsByDifficulty(sessionQuestions, sessionSeed);

  const filters: { key: DifficultyFilter; label: string }[] = [
    { key: 'all', label: `All (${questions.length})` },
    ...DIFFICULTY_LEVELS.map((level) => ({
      key: level as DifficultyFilter,
      label: `${level[0].toUpperCase()}${level.slice(1)} (${
        questions.filter((q) => (q.difficulty ?? 'medium') === level).length
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
                aria-current={active ? 'page' : undefined}
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
      {sessionReady && (
        <QuizGame
          key={`${difficulty}:${sessionSeed}`}
          questions={ordered}
          backHref={`/subjects/${subjectId}`}
          backLabel="Back to Topics"
          breadcrumbs={[
            { href: '/', label: 'Home' },
            { href: `/subjects/${subjectId}`, label: subjectName },
            { href: `/subjects/${subjectId}/${topicId}/study`, label: topicTitle },
            { label: 'Quiz' },
          ]}
          analytics={{ subjectId, topicId, source: 'topic_page' }}
          enableTimer={true}
          timerSeconds={60}
          onQuestionResult={(_questionId, _correct, _questionNumber, _totalCount, result) => {
            resultsRef.current.push(result);
          }}
          onComplete={(correctCount, totalCount) => {
            recordAttempt(topicId, subjectId as SubjectId, topicTitle, subjectId, correctCount, totalCount, resultsRef.current);
            resultsRef.current = [];
          }}
          onNewSet={grouped ? handleNewSet : undefined}
          onSimilarQuestions={canOfferSimilar ? handleSimilarQuestions : undefined}
          getHelpContext={() => ({ subjectId: subjectId as SubjectId, topicId })}
        />
      )}
    </div>
  );
}
