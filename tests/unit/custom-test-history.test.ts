import { describe, expect, it } from 'vitest';
import type { ExamResult, FreeResponseQuestion, Question, TopicProgress } from '@/content/types';
import {
  buildMcQuestionHistory,
  buildWrittenQuestionHistory,
  selectCustomQuestions,
  selectWrittenQuestions,
} from '@/lib/custom-test-history';
import type { MixedReviewQuestion } from '@/lib/mixed-review';

function question(id: string, stem = `Stem ${id}`, choices = ['A', 'B', 'C', 'D'], correctIndex = 0): Question {
  return { id, stem, choices, correctIndex, explanation: `Explanation ${id}`, difficulty: 'medium' };
}

function entry(topicId: string, value: Question): MixedReviewQuestion {
  return { topicId, subjectId: 'math', topicTitle: topicId, question: value };
}

function progress(topicId: string, date: string, questions: Question[]): TopicProgress {
  return {
    topicId,
    subjectId: 'math',
    topicTitle: topicId,
    subjectTitle: 'Maths',
    attempts: [{
      date,
      correctCount: questions.length,
      totalCount: questions.length,
      questionResults: questions.map((item) => ({ questionId: item.id, correct: true, question: item })),
    }],
  };
}

function written(id: string, topicId = 'topic-a'): FreeResponseQuestion {
  return {
    id,
    topicId,
    stem: `Written ${id}`,
    marks: 1,
    markscheme: ['B1: answer'],
    modelAnswer: 'answer',
    difficulty: 'medium',
  };
}

function exam(date: string, questions: FreeResponseQuestion[]): ExamResult {
  return {
    examId: 'custom-mixed-exam',
    date,
    correctCount: questions.length,
    totalCount: questions.length,
    secondsUsed: 60,
    questionResults: questions.map((item) => ({ question: item, studentAnswer: 'answer', ticks: [true] })),
  };
}

describe('custom-test question history', () => {
  it('excludes previously attempted authored questions by id', () => {
    const first = question('q1');
    const candidates = [entry('topic-a', first), entry('topic-a', question('q2'))];
    const history = buildMcQuestionHistory([progress('topic-a', '2026-11-01T00:00:00Z', [first])]);

    expect(selectCustomQuestions(candidates, 2, history, 'seed').map((item) => item.question.id).sort()).toEqual(['q1', 'q2']);
  });

  it('matches generated questions by content even when choice order and template instance differ', () => {
    const previous = question('tpl:0:generator', 'Work out 2 + 2.', ['3', '4', '5', '6'], 1);
    const repeated = question('tpl:1:generator', 'Work out 2 + 2.', ['6', '5', '4', '3'], 2);
    const fresh = question('tpl:0:generator', 'Work out 3 + 3.', ['5', '6', '7', '8'], 1);
    const history = buildMcQuestionHistory([progress('topic-a', '2026-11-01T00:00:00Z', [previous])]);

    const selected = selectCustomQuestions([entry('topic-a', repeated), entry('topic-a', fresh)], 1, history, 'seed');
    expect(selected.map((item) => item.question.stem)).toEqual(['Work out 3 + 3.']);
  });

  it('uses unseen questions first, then recycles the oldest seen question', () => {
    const oldest = question('q1');
    const newer = question('q2');
    const fresh = question('q3');
    const history = buildMcQuestionHistory([
      progress('topic-a', '2026-11-01T00:00:00Z', [oldest]),
      progress('topic-a', '2026-11-02T00:00:00Z', [newer]),
    ]);
    const candidates = [newer, oldest, fresh].map((item) => entry('topic-a', item));

    expect(selectCustomQuestions(candidates, 2, history, 'seed').map((item) => item.question.id).sort()).toEqual(['q1', 'q3']);
    expect(selectCustomQuestions(candidates.slice(0, 2), 1, history, 'seed').map((item) => item.question.id)).toEqual(['q1']);
  });

  it('balances unseen selections across topics and removes duplicate candidates', () => {
    const candidates = [
      entry('topic-a', question('a1')),
      entry('topic-a', question('a1')),
      entry('topic-a', question('a2')),
      entry('topic-b', question('b1')),
    ];

    const selected = selectCustomQuestions(candidates, 2, new Map(), 'seed');
    expect(new Set(selected.map((item) => item.topicId))).toEqual(new Set(['topic-a', 'topic-b']));
    expect(new Set(selected.map((item) => item.question.id)).size).toBe(2);
  });

  it('selects unseen written questions and falls back to the oldest when the pool is exhausted', () => {
    const oldest = written('w1');
    const newer = written('w2');
    const fresh = written('w3');
    const history = buildWrittenQuestionHistory([
      exam('2026-11-01T00:00:00Z', [oldest]),
      exam('2026-11-02T00:00:00Z', [newer]),
    ]);

    expect(selectWrittenQuestions([oldest, newer, fresh], 1, history, 'seed').map((item) => item.id)).toEqual(['w3']);
    expect(selectWrittenQuestions([oldest, newer], 1, history, 'seed').map((item) => item.id)).toEqual(['w1']);
  });
});
