import type { ExamResult, FreeResponseQuestion, Question, TopicProgress } from '@/content/types';
import type { MixedReviewQuestion } from './mixed-review';
import { orderQuestionsByDifficulty } from './quiz-utils';

export type QuestionHistory = ReadonlyMap<string, number>;

function authoredQuestionKey(topicId: string, questionId: string): string {
  return `mc:${topicId}:id:${questionId}`;
}

export function generatedQuestionKey(topicId: string, question: Question): string {
  const content = [
    question.stem,
    [...question.choices].sort(),
    question.choices[question.correctIndex],
  ];
  return `mc:${topicId}:content:${JSON.stringify(content)}`;
}

export function mcQuestionHistoryKey(topicId: string, question: Question): string {
  return question.id.startsWith('tpl:')
    ? generatedQuestionKey(topicId, question)
    : authoredQuestionKey(topicId, question.id);
}

export function buildMcQuestionHistory(topicProgress: TopicProgress[]): QuestionHistory {
  const history = new Map<string, number>();
  for (const topic of topicProgress) {
    for (const attempt of topic.attempts) {
      const seenAt = Date.parse(attempt.date) || 0;
      for (const result of attempt.questionResults ?? []) {
        const key = result.question
          ? mcQuestionHistoryKey(topic.topicId, result.question)
          : result.questionId.startsWith('tpl:')
            ? null
            : authoredQuestionKey(topic.topicId, result.questionId);
        if (key) history.set(key, Math.max(history.get(key) ?? 0, seenAt));
      }
    }
  }
  return history;
}

export function writtenQuestionHistoryKey(question: FreeResponseQuestion): string {
  return `written:${question.topicId ?? ''}:id:${question.id}`;
}

export function buildWrittenQuestionHistory(examResults: ExamResult[]): QuestionHistory {
  const history = new Map<string, number>();
  for (const result of examResults) {
    const seenAt = Date.parse(result.date) || 0;
    for (const item of result.questionResults ?? []) {
      const key = writtenQuestionHistoryKey(item.question);
      history.set(key, Math.max(history.get(key) ?? 0, seenAt));
    }
  }
  return history;
}

function selectByTopic<T>(
  candidates: T[],
  count: number,
  topicOf: (item: T) => string,
  keyOf: (item: T) => string,
  history: QuestionHistory
): T[] {
  const unique = new Map<string, T>();
  for (const candidate of candidates) {
    const key = keyOf(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
  }

  const fresh = new Map<string, T[]>();
  const seen = new Map<string, Array<{ item: T; seenAt: number; index: number }>>();
  Array.from(unique.values()).forEach((item, index) => {
    const topicId = topicOf(item);
    const seenAt = history.get(keyOf(item));
    if (seenAt === undefined) {
      const group = fresh.get(topicId) ?? [];
      group.push(item);
      fresh.set(topicId, group);
    } else {
      const group = seen.get(topicId) ?? [];
      group.push({ item, seenAt, index });
      seen.set(topicId, group);
    }
  });
  for (const group of seen.values()) {
    group.sort((a, b) => a.seenAt - b.seenAt || a.index - b.index);
  }

  const picked: T[] = [];
  const addRoundRobin = (groups: T[][]) => {
    for (let round = 0; picked.length < count; round++) {
      let added = false;
      for (let index = 0; index < groups.length && picked.length < count; index++) {
        const group = groups[(index + round) % groups.length];
        const item = group[round];
        if (item) {
          picked.push(item);
          added = true;
        }
      }
      if (!added) break;
    }
  };

  const topicIds = [...new Set(Array.from(unique.values(), topicOf))];
  addRoundRobin(topicIds.map((topicId) => fresh.get(topicId) ?? []));
  if (picked.length < count) {
    addRoundRobin(topicIds.map((topicId) => (seen.get(topicId) ?? []).map((entry) => entry.item)));
  }
  return picked;
}

export function selectCustomQuestions(
  candidates: MixedReviewQuestion[],
  count: number,
  history: QuestionHistory,
  seed: string
): MixedReviewQuestion[] {
  const picked = selectByTopic(
    candidates,
    count,
    (entry) => entry.topicId,
    (entry) => mcQuestionHistoryKey(entry.topicId, entry.question),
    history
  );
  return orderQuestionsByDifficulty(
    picked.map((entry) => ({ ...entry, difficulty: entry.question.difficulty })),
    seed
  );
}

export function selectWrittenQuestions(
  candidates: FreeResponseQuestion[],
  count: number,
  history: QuestionHistory,
  seed: string
): FreeResponseQuestion[] {
  const picked = selectByTopic(
    candidates,
    count,
    (question) => question.topicId ?? '',
    writtenQuestionHistoryKey,
    history
  );
  return orderQuestionsByDifficulty(picked, seed);
}
