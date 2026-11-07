import { describe, expect, it } from 'vitest';
import type { Question, TopicProgress } from '@/content/types';
import { deriveMistakes, deriveTopicImprovement } from '@/lib/mistake-notebook';

const question: Question = {
  id: 'q1', stem: 'Question?', choices: ['A', 'B', 'C', 'D'], correctIndex: 0,
  explanation: 'Explanation.', variantOf: 'skill-1',
};
const otherVariant: Question = { ...question, id: 'q2' };

function progress(results: { question: Question; correct: boolean }[]): TopicProgress {
  return {
    topicId: 'topic-1', subjectId: 'math', topicTitle: 'Fractions', subjectTitle: 'Maths',
    attempts: results.map((result, index) => ({
      date: `2026-11-0${index + 1}T00:00:00.000Z`, correctCount: result.correct ? 1 : 0, totalCount: 1,
      questionResults: [{
        questionId: result.question.id, correct: result.correct,
        selectedIndex: result.correct ? 0 : 1, question: result.question,
      }],
    })),
  };
}

describe('mistake notebook', () => {
  it('keeps an incorrect skill open after only one related correction', () => {
    const entries = deriveMistakes([progress([
      { question, correct: false }, { question: otherVariant, correct: true },
    ])]);
    expect(entries).toHaveLength(1);
    expect(entries[0].consecutiveCorrect).toBe(1);
    expect(entries[0].latestResult.selectedIndex).toBe(1);
  });

  it('resolves a skill after two consecutive related corrections', () => {
    expect(deriveMistakes([progress([
      { question, correct: false },
      { question: otherVariant, correct: true },
      { question, correct: true },
    ])])).toEqual([]);
  });

  it('resets the streak when a related question is wrong again', () => {
    const entries = deriveMistakes([progress([
      { question, correct: false }, { question, correct: true },
      { question, correct: true }, { question: otherVariant, correct: false },
    ])]);
    expect(entries).toHaveLength(1);
    expect(entries[0].latestResult.questionId).toBe('q2');
  });

  it('retains legacy correctness-only mistakes without inventing a snapshot', () => {
    const topic = progress([{ question, correct: false }]);
    topic.attempts[0].questionResults = [{ questionId: 'old-q', correct: false }];
    const entries = deriveMistakes([topic]);
    expect(entries[0].latestResult).toEqual({ questionId: 'old-q', correct: false });
    expect(entries[0].latestResult.question).toBeUndefined();
  });

  it('compares first and latest topic scores', () => {
    const topic = progress([{ question, correct: false }, { question, correct: true }]);
    expect(deriveTopicImprovement(topic)).toEqual({ topicId: 'topic-1', firstScore: 0, latestScore: 100, change: 100 });
    expect(deriveTopicImprovement(progress([{ question, correct: false }]))).toBeNull();
  });
});
