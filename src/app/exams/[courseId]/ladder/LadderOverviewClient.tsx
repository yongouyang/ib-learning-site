'use client';

import Link from 'next/link';
import { Lock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useProgress } from '@/context/ProgressContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LockedFeature } from '@/components/LockedFeature';
import { getCourse } from '@/lib/courses';
import { LADDER_LEVELS, LADDER_UNLOCK_SCORE, isLevelUnlocked, type LadderLevel } from '@/lib/ladder';
import { isFreeLadderLevel, FREE_LADDER_LEVELS } from '@/lib/entitlements/exam-access';

interface LadderOverviewClientProps {
  courseId: string;
}

export default function LadderOverviewClient({ courseId }: LadderOverviewClientProps) {
  const course = getCourse(courseId);
  const { ladderProgress } = useProgress();
  const { has } = useEntitlements();
  const hasFullExamAccess = has('exam-sets-full');

  if (!course) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Course not found.</div>;
  }

  const renderLevelRow = (level: LadderLevel) => {
    const unlocked = isLevelUnlocked(ladderProgress, courseId, level.level);
    const result = ladderProgress[courseId]?.[level.level];
    const mix = `${level.targets.easy} easy · ${level.targets.medium} medium · ${level.targets.hard} hard`;
    // Levels 3–5 are premium-gated AND score-gated — for sessions without the
    // feature the locked subtext names both gates, never score alone.
    const lockedHint = isFreeLadderLevel(level.level) || hasFullExamAccess
      ? `Score ≥${Math.round(LADDER_UNLOCK_SCORE * 100)}% on Level ${level.level - 1} to unlock`
      : `Premium · unlock with ≥${Math.round(LADDER_UNLOCK_SCORE * 100)}% on Level ${level.level - 1}`;

    const inner = (
      <>
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
          unlocked
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
        }`}>
          {unlocked ? <TrendingUp className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </span>
        <span className="flex-1">
          <span className={`block text-sm font-medium ${unlocked ? 'text-gray-900 dark:text-gray-50' : 'text-gray-400 dark:text-gray-500'}`}>
            {level.title}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {unlocked ? mix : lockedHint}
          </span>
        </span>
        {result && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${result.bestScore >= LADDER_UNLOCK_SCORE ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {result.bestScore >= LADDER_UNLOCK_SCORE && <CheckCircle2 className="w-3.5 h-3.5" />}
            Best: {Math.round(result.bestScore * 100)}%
          </span>
        )}
      </>
    );

    return unlocked ? (
      <Link
        key={level.level}
        href={`/exams/${courseId}/ladder/${level.level}`}
        className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow active:scale-[0.99]"
      >
        {inner}
      </Link>
    ) : (
      <div key={level.level} className="card p-3.5 flex items-center gap-3 opacity-70">
        {inner}
      </div>
    );
  };

  // Phase E3 — levels 1–2 free, the upper levels Premium (entitlement-policy
  // §Tier 2); the tease wraps the rows, the score-unlock logic still applies
  // for Premium users.
  const freeLevels = LADDER_LEVELS.filter((l) => isFreeLadderLevel(l.level));
  const premiumLevels = LADDER_LEVELS.filter((l) => !isFreeLadderLevel(l.level));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/exams', label: 'Mock Exams' }, { label: `${course.title} Ladder` }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Revision Ladder — {course.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Five cross-topic sets of increasing difficulty. Score {Math.round(LADDER_UNLOCK_SCORE * 100)}% or more on a level to unlock the next.
        </p>
      </div>

      <div className="grid gap-2">
        {freeLevels.map(renderLevelRow)}
      </div>
      {premiumLevels.length > 0 && (
        <LockedFeature
          feature="exam-sets-full"
          title="Upper ladder levels"
          benefit={`Premium unlocks levels ${FREE_LADDER_LEVELS + 1}–${LADDER_LEVELS.length}, every exam set and timed mock mode.`}
        >
          <div className="grid gap-2 mt-2">
            {premiumLevels.map(renderLevelRow)}
          </div>
        </LockedFeature>
      )}
    </div>
  );
}
