import { Question, TopicProgress, SubjectId } from '@/content/types';
import { getSubjects } from '@/content/registry';
import { getWeakTopics } from '@/lib/weak-point-analyzer';
import { stratifiedSample, seededShuffle } from '@/lib/quiz-utils';

export const MIXED_REVIEW_TOPIC_ID = 'mixed-review';
export const MIXED_REVIEW_SUBJECT_ID: SubjectId = 'math';
export const MIXED_REVIEW_TITLE = 'Mixed Review';
export const MIXED_REVIEW_COUNT = 10;
// Per-band targets for each mixed-review set (sums to MIXED_REVIEW_COUNT).
export const MIXED_REVIEW_BAND_TARGETS = { easy: 3, medium: 4, hard: 3 } as const;

export interface MixedReviewQuestion {
  question: Question;
  topicId: string;
  subjectId: SubjectId;
  topicTitle: string;
}

export function buildMixedReviewQuestions(
  topicProgress: TopicProgress[],
  mode: 'random' | 'weak' = 'random',
  // Deterministic draw seed. Omit for the old Math.random behaviour; pass one
  // from a component that can be server-rendered (see MixedReviewClient).
  seed?: string
): { questions: MixedReviewQuestion[]; usedWeakTopics: boolean; weakTopicCount: number } {
  const all: MixedReviewQuestion[] = [];
  getSubjects().forEach((subject) => {
    subject.topics.forEach((topic) => {
      topic.questions.forEach((question) => {
        all.push({
          question,
          topicId: topic.id,
          subjectId: subject.id,
          topicTitle: topic.title,
        });
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
