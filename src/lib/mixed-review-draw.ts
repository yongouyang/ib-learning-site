import { getAllContentTopics } from '@/content/registry.content';
import { seededShuffle, stratifiedSample } from '@/lib/quiz-utils';
import { MIXED_REVIEW_BAND_TARGETS, MIXED_REVIEW_COUNT, type MixedReviewQuestion } from '@/lib/mixed-review';
import type { Topic } from '@/content/types';

/**
 * Mixed review's draw — SERVER-ONLY (Phase 1b, docs/premium-content-protection-plan.md §1.1
 * decision 8). Mixed review is the one free surface whose input cannot be known at build time, so it
 * is the one runtime API for free content: the client sends the ids of its weak topics (or none for
 * all topics) and this draws from them. The questions are free content by design, so the response is
 * edge-cacheable — and drawing here is also what let the client stop bundling the content bank
 * entirely (its temporary lazy chunk is gone).
 */
export function drawMixedReviewQuestions({
  topicIds,
  seed,
}: {
  /** Restrict the pool to these topics (weak areas); null/empty = every topic. */
  topicIds?: readonly string[] | null;
  seed: string;
}): MixedReviewQuestion[] {
  const wanted = topicIds && topicIds.length > 0 ? new Set(topicIds) : null;
  const topics: Topic[] = getAllContentTopics().filter((topic) => !wanted || wanted.has(topic.id));

  const pool: MixedReviewQuestion[] = [];
  for (const topic of topics) {
    for (const question of topic.questions) {
      pool.push({
        question,
        topicId: topic.id,
        subjectId: topic.subjectId,
        topicTitle: topic.title,
      });
    }
  }

  const questions = stratifiedSample(pool, MIXED_REVIEW_BAND_TARGETS, (mq) => mq.question.difficulty, seed);

  if (questions.length === 0) {
    // Ultimate fallback: any question from the pool (a band running dry must not empty the set).
    return seededShuffle(pool, `${seed}:fallback`).slice(0, MIXED_REVIEW_COUNT);
  }

  return questions;
}
