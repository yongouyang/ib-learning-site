import type { DifficultyFilter } from './quiz-utils';
import type { MixedReviewQuestion } from './mixed-review';
import type { FreeResponseQuestion } from '@/content/types';

export type CustomQuestionType = 'multiple-choice' | 'mixed';
export const MIXED_EXAM_TOPIC_IDS = [
  'math-yr7-calculations', 'math-algebra-1', 'math-yr7-area-perimeter', 'math-yr7-equations',
  'math-yr7-angles', 'math-fractions-1', 'math-yr7-sequences', 'math-yr7-percentages',
] as const;

export const CUSTOM_TEST_COUNTS = [5, 10, 15, 20] as const;
export type CustomTestCount = (typeof CUSTOM_TEST_COUNTS)[number];
export type CustomTestMode = 'practice' | 'timed';

export interface CustomTestSettings {
  topicIds: string[];
  count: CustomTestCount;
  difficulty: DifficultyFilter;
  mode: CustomTestMode;
  questionType?: CustomQuestionType;
  seed: string;
}

export interface CustomTestPayload {
  questions: MixedReviewQuestion[];
  writtenQuestions: FreeResponseQuestion[];
}

export function customTestSeconds(count: number): number {
  return count * 60;
}
