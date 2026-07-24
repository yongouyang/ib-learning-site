import { describe, it, expect } from 'vitest';
import { checkStageConsistency } from '../../scripts/validate-content';
import type { ValidatedTopic } from '@/content/schema';

function makeTopic(overrides: Partial<ValidatedTopic> = {}): ValidatedTopic {
  return {
    id: 'test-topic-1',
    subjectId: 'math',
    title: 'Test Topic',
    description: 'A topic for testing validation.',
    stage: 'ks3',
    notes: [{ id: 'n1', heading: 'Note 1', body: 'This is a note body.' }],
    flashcards: [{ id: 'f1', term: 'Term', definition: 'Definition of the term.' }],
    questions: [
      {
        id: 'q1',
        stem: 'What is 2 + 2?',
        choices: ['2', '3', '4', '5'],
        correctIndex: 2,
        explanation: 'Two plus two equals four.',
      },
    ],
    ...overrides,
  };
}

describe('checkStageConsistency', () => {
  it('accepts calculator tags on math questions', () => {
    const topic = makeTopic({
      questions: [
        {
          id: 'q1',
          stem: 'What is 2 + 2?',
          choices: ['2', '3', '4', '5'],
          correctIndex: 2,
          explanation: 'Two plus two equals four.',
          calculator: true,
        },
      ],
    });
    expect(checkStageConsistency(topic)).toEqual([]);
  });

  it('rejects calculator tags on non-math questions', () => {
    const topic = makeTopic({
      subjectId: 'biology',
      questions: [
        {
          id: 'q1',
          stem: 'Which organelle makes proteins?',
          choices: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'],
          correctIndex: 1,
          explanation: 'Ribosomes are the site of protein synthesis.',
          calculator: false,
        },
        {
          id: 'q2',
          stem: 'Which organelle releases energy?',
          choices: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'],
          correctIndex: 2,
          explanation: 'Mitochondria carry out aerobic respiration.',
          calculator: true,
        },
      ],
    });
    const errors = checkStageConsistency(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('calculator');
    expect(errors[0]).toContain('2 question(s)');
  });

  it('ignores untagged questions on non-math topics', () => {
    const topic = makeTopic({ subjectId: 'english' });
    expect(checkStageConsistency(topic)).toEqual([]);
  });
});
