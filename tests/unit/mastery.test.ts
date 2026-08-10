import { describe, it, expect } from 'vitest';
import {
  computeGroupMastery,
  getMasterySummary,
  MASTERY_STREAK_REQUIRED,
} from '@/lib/mastery';
import type { Question, QuizAttempt } from '@/content/types';

function q(id: string, variantOf?: string): Question {
  return {
    id,
    stem: `Stem ${id}`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `Explanation ${id}`,
    difficulty: 'medium',
    ...(variantOf ? { variantOf } : {}),
  };
}

function attempt(results: [string, boolean][]): QuizAttempt {
  return {
    date: new Date().toISOString(),
    correctCount: results.filter(([, c]) => c).length,
    totalCount: results.length,
    questionResults: results.map(([questionId, correct]) => ({ questionId, correct })),
  };
}

// Two skills: "skill-a" (2 variants) and "skill-b" (1 variant) + one solo question.
const questions = [q('a1', 'skill-a'), q('a2', 'skill-a'), q('b1', 'skill-b'), q('solo1')];

describe('computeGroupMastery', () => {
  it('reports every group, including unattempted ones', () => {
    const mastery = computeGroupMastery(questions, []);
    expect(mastery.size).toBe(3);
    expect(mastery.get('skill-a')).toMatchObject({ outcomes: 0, mastered: false });
  });

  it('aggregates outcomes across variants of the same group', () => {
    const mastery = computeGroupMastery(questions, [
      attempt([['a1', true]]),
      attempt([['a2', true]]),
    ]);
    expect(mastery.get('skill-a')).toMatchObject({
      outcomes: 2,
      correctOutcomes: 2,
      streak: 2,
      mastered: true,
    });
  });

  it('requires consecutive correct outcomes — an incorrect resets the streak', () => {
    const mastery = computeGroupMastery(questions, [
      attempt([['a1', true]]),
      attempt([['a2', false]]),
      attempt([['a1', true]]),
    ]);
    expect(mastery.get('skill-a')).toMatchObject({
      outcomes: 3,
      correctOutcomes: 2,
      streak: 1,
      mastered: false,
    });
  });

  it('ignores attempts without per-question results (legacy aggregates)', () => {
    const legacy: QuizAttempt = { date: new Date().toISOString(), correctCount: 9, totalCount: 10 };
    const mastery = computeGroupMastery(questions, [legacy]);
    expect(mastery.get('skill-a')!.outcomes).toBe(0);
  });

  it('ignores question ids that no longer exist in the topic', () => {
    const mastery = computeGroupMastery(questions, [
      attempt([['deleted-question', true], ['a1', true]]),
    ]);
    expect(mastery.get('skill-a')!.outcomes).toBe(1);
  });
});

describe('getMasterySummary', () => {
  it('counts mastered groups against total groups', () => {
    const attempts = [
      attempt([['a1', true], ['b1', true], ['solo1', false]]),
      attempt([['a2', true], ['b1', true]]),
    ];
    const summary = getMasterySummary(questions, attempts);
    expect(summary.totalGroups).toBe(3);
    expect(summary.masteredGroups).toBe(2); // skill-a + skill-b; solo1 has a failing streak
  });

  it('masters a solo question after the required streak', () => {
    const attempts = Array.from({ length: MASTERY_STREAK_REQUIRED }, () =>
      attempt([['solo1', true]])
    );
    expect(getMasterySummary(questions, attempts).masteredGroups).toBe(1);
  });
});
