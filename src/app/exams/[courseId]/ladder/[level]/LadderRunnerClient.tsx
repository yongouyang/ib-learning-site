'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import QuizGame from '@/components/QuizGame';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import { LockedQuizPreview } from '@/components/LockedQuizPreview';
import { getCourse } from '@/lib/courses';
import { getLadderLevel, isLevelUnlocked, LADDER_LEVELS, LADDER_UNLOCK_SCORE } from '@/lib/ladder';
import type { MixedReviewQuestion } from '@/lib/mixed-review';
import { isFreeLadderLevel, FREE_LADDER_LEVELS } from '@/lib/entitlements/exam-access';
import { trackEvent } from '@/lib/analytics';

interface LadderRunnerClientProps {
  courseId: string;
  level: number;
  /** Composed at build time by the server page (Phase 1a) — the client never reads the bank. */
  questions: MixedReviewQuestion[];
}

export default function LadderRunnerClient({ courseId, level, questions }: LadderRunnerClientProps) {
  const course = getCourse(courseId);
  const levelDef = getLadderLevel(level);
  const { ladderProgress, recordLadder } = useProgress();
  const { has, loaded } = useEntitlements();
  const recorded = useRef(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    trackEvent('quiz_started', { subjectId: 'ladder', topicId: courseId, source: 'ladder' });
  }, [courseId]);

  const handleComplete = (correctCount: number, totalCount: number) => {
    if (recorded.current) return;
    recorded.current = true;
    recordLadder(courseId, level, correctCount / Math.max(totalCount, 1));
    trackEvent('quiz_completed', {
      subjectId: 'ladder',
      topicId: courseId,
      correctCount,
      totalCount,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
  };

  if (!course || !levelDef || questions.length === 0) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Ladder level not found.</div>;
  }

  const content = !isLevelUnlocked(ladderProgress, courseId, level) ? (
    // The locked wall is a real destination (the overview links score-locked
    // free levels so crawlers can reach /ladder/2) — same chrome as the
    // premium branch below: Breadcrumbs + h1 + the way forward.
    <div className="max-w-lg mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/exams', label: 'Mock Exams' },
          { href: `/exams/${courseId}/ladder`, label: `${course.title} Ladder` },
          { label: `Level ${level}` },
        ]}
      />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{course.title} · {levelDef.title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This level is locked — score {Math.round(LADDER_UNLOCK_SCORE * 100)}% or more on Level {level - 1} to unlock it.
        </p>
      </div>
      <Link
        href={level > 1 ? `/exams/${courseId}/ladder/${level - 1}` : `/exams/${courseId}/ladder`}
        className="inline-flex items-center gap-1.5 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {level > 1 ? `Go to Level ${level - 1}` : 'Back to the ladder'}
      </Link>
    </div>
  ) : (
    <QuizGame
      subtitle={`${course.title} · ${levelDef.title} · Non-calculator`}
      backHref={`/exams/${courseId}/ladder`}
      backLabel="Back to Ladder"
      breadcrumbs={[
        { href: '/', label: 'Home' },
        { href: '/exams', label: 'Mock Exams' },
        { href: `/exams/${courseId}/ladder`, label: `${course.title} Ladder` },
        { label: `Level ${level}` },
      ]}
      questions={questions.map((q) => q.question)}
      shuffleSeed={`ladder:${courseId}:${level}`}
      enableTimer={false}
      onComplete={handleComplete}
    />
  );

  // Phase E3 — upper levels are Premium (entitlement-policy §Tier 2). For
  // levels 3–5 the real gate is premium AND score, so the locked view says
  // both: the score status shows LIVE above the tease (never ghosted inside
  // the preview), and a static summary stands in for the quiz.
  if (isFreeLadderLevel(level) || !loaded || has('exam-sets-full')) return content;

  const scoreLocked = !isLevelUnlocked(ladderProgress, courseId, level);
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/exams', label: 'Mock Exams' },
          { href: `/exams/${courseId}/ladder`, label: `${course.title} Ladder` },
          { label: `Level ${level}` },
        ]}
      />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{course.title} · {levelDef.title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{questions.length} questions · Non-calculator</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {scoreLocked
            ? `Premium level — you'll also need ${Math.round(LADDER_UNLOCK_SCORE * 100)}% or more on Level ${level - 1} to unlock it.`
            : `Your Level ${level - 1} score unlocked this level — it's part of Premium.`}
        </p>
      </div>
      <LockedFeature
        feature="exam-sets-full"
        title="Upper ladder levels"
        benefit={`Premium unlocks levels ${FREE_LADDER_LEVELS + 1}–${LADDER_LEVELS.length}, every exam set and timed mock mode.`}
      >
        <LockedQuizPreview questions={questions.map((q) => q.question)} />
      </LockedFeature>
    </div>
  );
}
