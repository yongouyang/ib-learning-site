import { describe, it, expect } from 'vitest';
import { checkStageConsistency, checkVariantGroups } from '../../scripts/validate-content';
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

  it('accepts a strand on KS3 english topics', () => {
    const topic = makeTopic({ subjectId: 'english', stage: 'ks3', strand: 'reading' });
    expect(checkStageConsistency(topic)).toEqual([]);
  });

  it('rejects a strand on non-english topics', () => {
    const topic = makeTopic({ subjectId: 'math', stage: 'ks3', strand: 'reading' });
    const errors = checkStageConsistency(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('strand');
  });

  it('rejects a strand on non-KS3 english topics', () => {
    const topic = makeTopic({ subjectId: 'english', stage: 'igcse', course: '0500', strand: 'writing' });
    const errors = checkStageConsistency(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('strand');
  });
});


describe('checkVariantGroups', () => {
  function groupQuestion(id: string, variantOf: string, difficulty?: 'easy' | 'medium' | 'hard') {
    return {
      id,
      stem: `Stem ${id}`,
      choices: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: `Explanation for ${id}.`,
      ...(difficulty ? { difficulty } : {}),
      variantOf,
    };
  }

  it('accepts a group whose members share one difficulty', () => {
    const topic = makeTopic({
      questions: [
        groupQuestion('q1', 'skill-a', 'easy'),
        groupQuestion('q2', 'skill-a', 'easy'),
      ],
    });
    expect(checkVariantGroups(topic)).toEqual([]);
  });

  it('accepts single-member groups (audit warns; not an error here)', () => {
    const topic = makeTopic({
      questions: [groupQuestion('q1', 'skill-a', 'easy')],
    });
    expect(checkVariantGroups(topic)).toEqual([]);
  });

  it('rejects a group mixing difficulties', () => {
    const topic = makeTopic({
      questions: [
        groupQuestion('q1', 'skill-a', 'easy'),
        groupQuestion('q2', 'skill-a', 'hard'),
      ],
    });
    const errors = checkVariantGroups(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('skill-a');
    expect(errors[0]).toContain('mixes difficulties');
  });

  it('rejects a multi-member group with an untagged member', () => {
    const topic = makeTopic({
      questions: [
        groupQuestion('q1', 'skill-a', 'easy'),
        groupQuestion('q2', 'skill-a'),
      ],
    });
    const errors = checkVariantGroups(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('untagged');
  });

  it('ignores questions without variantOf', () => {
    const topic = makeTopic();
    expect(checkVariantGroups(topic)).toEqual([]);
  });
});
