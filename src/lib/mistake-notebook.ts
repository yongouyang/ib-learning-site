import type { QuestionResult, SubjectId, TopicProgress } from '@/content/types';
import { groupKeyOf } from './quiz-utils';
import { MASTERY_STREAK_REQUIRED } from './mastery';

export interface MistakeEntry {
  key: string;
  topicId: string;
  subjectId: SubjectId;
  topicTitle: string;
  subjectTitle: string;
  latestResult: QuestionResult;
  firstIncorrectAt: string;
  latestIncorrectAt: string;
  consecutiveCorrect: number;
}

export interface TopicImprovement {
  topicId: string;
  firstScore: number;
  latestScore: number;
  change: number;
}

interface OpenMistake {
  entry: MistakeEntry;
  consecutiveCorrect: number;
}

export function deriveMistakes(topicProgress: TopicProgress[]): MistakeEntry[] {
  const mistakes: MistakeEntry[] = [];
  for (const topic of topicProgress) {
    const groups = new Map<string, OpenMistake>();
    for (const attempt of topic.attempts) {
      for (const result of attempt.questionResults ?? []) {
        const key = result.question ? groupKeyOf(result.question) : `solo:${result.questionId}`;
        const existing = groups.get(key);
        const state: OpenMistake = existing ?? {
          entry: {
            key: `${topic.subjectId}:${topic.topicId}:${key}`,
            topicId: topic.topicId,
            subjectId: topic.subjectId,
            topicTitle: topic.topicTitle,
            subjectTitle: topic.subjectTitle,
            latestResult: result,
            firstIncorrectAt: attempt.date,
            latestIncorrectAt: attempt.date,
            consecutiveCorrect: 0,
          },
          consecutiveCorrect: 0,
        };
        if (result.correct) {
          state.consecutiveCorrect += 1;
        } else {
          state.consecutiveCorrect = 0;
          state.entry.latestResult = result;
          state.entry.latestIncorrectAt = attempt.date;
        }
        state.entry.consecutiveCorrect = state.consecutiveCorrect;
        groups.set(key, state);
      }
    }
    for (const { entry, consecutiveCorrect } of groups.values()) {
      if (consecutiveCorrect < MASTERY_STREAK_REQUIRED) mistakes.push(entry);
    }
  }
  return mistakes.sort((a, b) => b.latestIncorrectAt.localeCompare(a.latestIncorrectAt));
}

export function deriveTopicImprovement(topic: TopicProgress): TopicImprovement | null {
  if (topic.attempts.length < 2) return null;
  const first = topic.attempts[0];
  const latest = topic.attempts[topic.attempts.length - 1];
  const firstScore = Math.round((first.correctCount / first.totalCount) * 100);
  const latestScore = Math.round((latest.correctCount / latest.totalCount) * 100);
  return { topicId: topic.topicId, firstScore, latestScore, change: latestScore - firstScore };
}
