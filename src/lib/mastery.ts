import type { Question, QuizAttempt, Topic } from '@/content/types';
import { groupKeyOf } from './quiz-utils';
import { templateQuestionId } from './generators';

// Per-group mastery (docs/question-variations-plan.md, decision D6).
// The stored attempt log is per-session aggregates with optional per-question
// outcomes (QuizAttempt.questionResults, present on topic-quiz attempts since
// the variant-group rollout). Mastery is derived at read time by mapping each
// answered question id to its variant group in the CURRENT topic content —
// nothing is migrated or rewritten in storage.

export interface GroupMastery {
  /** variantOf key, or `solo:<questionId>` for ungrouped questions. */
  groupKey: string;
  outcomes: number;
  correctOutcomes: number;
  /** Trailing consecutive-correct count (resets on any incorrect outcome). */
  streak: number;
  mastered: boolean;
}

export interface MasterySummary {
  masteredGroups: number;
  totalGroups: number;
}

/** A group is mastered after this many consecutive correct outcomes. */
export const MASTERY_STREAK_REQUIRED = 2;

/**
 * Fold the per-question outcomes of all attempts (oldest first) into one
 * GroupMastery per group in the topic. Every group appears in the result —
 * groups with no recorded outcomes have zeros, so callers can show "x of y
 * skills mastered". Attempts without questionResults contribute nothing.
 */
export function computeGroupMastery(
  questions: Pick<Question, 'id' | 'variantOf'>[],
  attempts: Pick<QuizAttempt, 'questionResults'>[]
): Map<string, GroupMastery> {
  const mastery = new Map<string, GroupMastery>();
  for (const q of questions) {
    const key = groupKeyOf(q);
    if (!mastery.has(key)) {
      mastery.set(key, { groupKey: key, outcomes: 0, correctOutcomes: 0, streak: 0, mastered: false });
    }
  }
  for (const attempt of attempts) {
    for (const result of attempt.questionResults ?? []) {
      const question = questions.find((q) => q.id === result.questionId);
      if (!question) continue; // stale id (content changed) — ignore
      const entry = mastery.get(groupKeyOf(question))!;
      entry.outcomes += 1;
      if (result.correct) {
        entry.correctOutcomes += 1;
        entry.streak += 1;
      } else {
        entry.streak = 0;
      }
      entry.mastered = entry.streak >= MASTERY_STREAK_REQUIRED;
    }
  }
  return mastery;
}

export function getMasterySummary(
  questions: Pick<Question, 'id' | 'variantOf'>[],
  attempts: Pick<QuizAttempt, 'questionResults'>[]
): MasterySummary {
  const mastery = computeGroupMastery(questions, attempts);
  let masteredGroups = 0;
  for (const entry of mastery.values()) {
    if (entry.mastered) masteredGroups += 1;
  }
  return { masteredGroups, totalGroups: mastery.size };
}

/**
 * Placeholder entries for a topic's question templates, matching the ids that
 * materializeTemplates (src/lib/generators.ts) gives generated instances.
 * Pass [...topic.questions, ...templatePlaceholders(topic)] to
 * computeGroupMastery so generated-question outcomes count toward their group.
 */
export function templatePlaceholders(topic: Topic): Pick<Question, 'id' | 'variantOf'>[] {
  return (topic.templates ?? []).map((tpl, index) => ({
    id: templateQuestionId(index, tpl.generator),
    ...(tpl.variantOf !== undefined ? { variantOf: tpl.variantOf } : {}),
  }));
}
