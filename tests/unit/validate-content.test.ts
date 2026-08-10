import { describe, it, expect } from 'vitest';
import { checkStageConsistency, checkTemplates, checkVariantGroups } from '../../scripts/validate-content';
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

describe('checkTemplates', () => {
  const linearParams = { a: [2, 3, 4], b: [1, 3, 5], x: [2, 3, 4, 5] };

  it('accepts a valid template that joins a matching-difficulty group', () => {
    const topic = makeTopic({
      questions: [
        { id: 'q1', stem: 'Solve $2x + 1 = 5$.', choices: ['1', '2', '3', '4'], correctIndex: 1, explanation: 'Subtract 1, then divide by 2.', difficulty: 'medium', variantOf: 'two-step' },
        { id: 'q2', stem: 'Solve $3x - 2 = 7$.', choices: ['1', '2', '3', '4'], correctIndex: 2, explanation: 'Add 2, then divide by 3.', difficulty: 'medium', variantOf: 'two-step' },
      ],
      templates: [{ generator: 'math-linear-equation', variantOf: 'two-step', params: linearParams }],
    });
    expect(checkTemplates(topic)).toEqual([]);
  });

  it('accepts a template whose variantOf matches no authored group (its own group)', () => {
    const topic = makeTopic({
      templates: [{ generator: 'math-linear-equation', variantOf: 'brand-new-group', params: linearParams }],
    });
    expect(checkTemplates(topic)).toEqual([]);
  });

  it('accepts a template with no variantOf and no params requirements violated', () => {
    const topic = makeTopic({
      templates: [{ generator: 'math-fraction-arithmetic', params: { den1: [2, 3], den2: [4, 5], maxNum: 2 } }],
    });
    expect(checkTemplates(topic)).toEqual([]);
  });

  it('rejects an unknown generator id', () => {
    const topic = makeTopic({
      templates: [{ generator: 'not-a-generator', params: {} }],
    });
    const errors = checkTemplates(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not-a-generator');
    expect(errors[0]).toContain('unknown generator');
  });

  it('rejects params that fail the generator paramsSchema', () => {
    const topic = makeTopic({
      templates: [{ generator: 'math-linear-equation', params: { a: 'oops' } }],
    });
    const errors = checkTemplates(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('math-linear-equation');
    expect(errors[0]).toContain('paramsSchema');
  });

  it('rejects a template whose difficulty differs from its group', () => {
    const topic = makeTopic({
      questions: [
        { id: 'q1', stem: 'Easy one?', choices: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'Because it is easy.', difficulty: 'easy', variantOf: 'easy-group' },
        { id: 'q2', stem: 'Easy two?', choices: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'Also easy.', difficulty: 'easy', variantOf: 'easy-group' },
      ],
      // math-linear-equation is medium; the group is easy.
      templates: [{ generator: 'math-linear-equation', variantOf: 'easy-group', params: linearParams }],
    });
    const errors = checkTemplates(topic);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('does not match');
    expect(errors[0]).toContain('easy-group');
  });
});
