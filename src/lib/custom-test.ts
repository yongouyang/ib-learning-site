import type { DifficultyFilter } from './quiz-utils';
import type { MixedReviewQuestion } from './mixed-review';

export const CUSTOM_TEST_COUNTS = [5, 10, 15, 20] as const;
export type CustomTestCount = (typeof CUSTOM_TEST_COUNTS)[number];
export type CustomTestMode = 'practice' | 'timed';

export interface CustomTestSettings {
  topicIds: string[];
  count: CustomTestCount;
  difficulty: DifficultyFilter;
  mode: CustomTestMode;
  seed: string;
}

export interface CustomTestPayload {
  questions: MixedReviewQuestion[];
}

export function customTestSeconds(count: number): number {
  return count * 60;
}
