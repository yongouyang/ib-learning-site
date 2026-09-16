/**
 * Mixed review's draw, deliberately in its own module.
 *
 * It is the one free surface whose input cannot be known at build time — it composes across whatever
 * topics the user's own progress marks as weak — so it needs the topic content bank in the browser.
 * Keeping it out of `src/lib/mixed-review.ts` (which carries the types and constants every other
 * consumer imports) is what stops that bank from being pulled into the shared chunks: this file is
 * reached only through a dynamic `import()` from MixedReviewClient, so the bundler emits it as a
 * separate, route-scoped chunk.
 *
 * Phase 1b replaces this transport with `GET /api/content/public/mixed-review?topicIds=…`
 * (docs/premium-content-protection-plan.md §1.1 decision 8, §5).
 */
import { getAllContentTopics } from '@/content/registry.content';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import { seededShuffle, stratifiedSample } from '@/lib/quiz-utils';
import {
  MIXED_REVIEW_BAND_TARGETS,
  MIXED_REVIEW_COUNT,
  type MixedReviewQuestion,
} from '@/lib/mixed-review';
import type { TopicProgress } from '@/content/types';

export function buildMixedReviewQuestions(
  topicProgress: TopicProgress[],
  mode: 'random' | 'weak' = 'random',
  // Deterministic draw seed. Omit for the old Math.random behaviour; pass one
  // from a component that can be server-rendered (see MixedReviewClient).
  seed?: string
): { questions: MixedReviewQuestion[]; usedWeakTopics: boolean; weakTopicCount: number } {
  const all: MixedReviewQuestion[] = [];
  getAllContentTopics().forEach((topic) => {
    topic.questions.forEach((question) => {
      all.push({
        question,
        topicId: topic.id,
        subjectId: topic.subjectId,
        topicTitle: topic.title,
      });
    });
  });

  let pool = [...all];
  let usedWeakTopics = false;
  let weakTopicCount = 0;

  if (mode === 'weak') {
    const weakTopics = getWeakTopics(topicProgress);
    weakTopicCount = weakTopics.length;
    if (weakTopics.length > 0) {
      const weakKeys = new Set(weakTopics.map((tp) => `${tp.subjectId}:${tp.topicId}`));
      pool = all.filter((q) => weakKeys.has(`${q.subjectId}:${q.topicId}`));
      usedWeakTopics = true;
    }
  }

  const questions = stratifiedSample(pool, MIXED_REVIEW_BAND_TARGETS, (mq) => mq.question.difficulty, seed);

  if (questions.length === 0) {
    // Ultimate fallback: any available question.
    const fallback = seed
      ? seededShuffle(all, `${seed}:fallback`).slice(0, MIXED_REVIEW_COUNT)
      : all.sort(() => Math.random() - 0.5).slice(0, MIXED_REVIEW_COUNT);
    return { questions: fallback, usedWeakTopics: false, weakTopicCount };
  }

  return { questions, usedWeakTopics, weakTopicCount };
}
