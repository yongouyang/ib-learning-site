import { describe, it, expect } from 'vitest';
import { materializeTemplates, templateQuestionId } from '@/lib/generators';
import { computeGroupMastery, templatePlaceholders } from '@/lib/mastery';
import type { Question, QuizAttempt, Topic } from '@/content/types';

function authoredQuestion(id: string, variantOf?: string): Question {
  return {
    id,
    stem: `Stem ${id}`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `Explanation for ${id}.`,
    difficulty: 'medium',
    ...(variantOf ? { variantOf } : {}),
  };
}

// Minimal topic with two templates: one joining an authored group, one solo.
function makeTopic(): Topic {
  return {
    id: 'test-topic',
    subjectId: 'math',
    title: 'Test Topic',
    description: 'Topic with templates.',
    stage: 'ks3',
    notes: [{ id: 'n1', heading: 'Note', body: 'Body.' }],
    flashcards: [{ id: 'f1', term: 'Term', definition: 'Definition.' }],
    questions: [authoredQuestion('q1', 'skill-a'), authoredQuestion('q2', 'skill-a')],
    templates: [
      {
        generator: 'math-linear-equation',
        variantOf: 'skill-a',
        params: { a: [2, 3, 4], b: [1, 3, 5], x: [2, 3, 4, 5] },
      },
      {
        generator: 'phys-fuse-rating',
        params: { watts: [460, 920, 1380] },
      },
    ],
  };
}

describe('materializeTemplates', () => {
  it('is deterministic per (topic, seed)', () => {
    const topic = makeTopic();
    expect(materializeTemplates(topic, 'seed-a')).toEqual(materializeTemplates(topic, 'seed-a'));
  });

  it('produces ids, difficulties and group keys from the template entries', () => {
    const [first, second] = materializeTemplates(makeTopic(), 'seed-a');
    expect(first.id).toBe('tpl:0:math-linear-equation');
    expect(first.variantOf).toBe('skill-a');
    expect(first.difficulty).toBe('medium');
    expect(second.id).toBe('tpl:1:phys-fuse-rating');
    expect(second.variantOf).toBeUndefined();
    expect(second.difficulty).toBe('hard');
  });

  it('returns valid 4-choice questions with the correct answer at correctIndex', () => {
    for (const q of materializeTemplates(makeTopic(), 'seed-a')) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices[q.correctIndex]).toBeTruthy();
    }
    // Spot-check the math answer: correctIndex points at the actual solution.
    const [first] = materializeTemplates(makeTopic(), 'seed-a');
    const m = first.stem.match(/^Solve \$(\d+)x \+ (\d+) = (\d+)\$\.$/);
    expect(m).not.toBeNull();
    const [, a, b, c] = m!.map(Number);
    const solution = (c - b) / a;
    expect(first.choices[first.correctIndex]).toBe(`$x = ${solution}$`);
  });

  it('draws different values for different seeds', () => {
    const topic = makeTopic();
    const stems = new Set(
      Array.from({ length: 30 }, (_, i) => materializeTemplates(topic, `seed-${i}`)[0].stem)
    );
    expect(stems.size).toBeGreaterThan(1);
  });

  it('varies correctIndex across seeds (choices are shuffled)', () => {
    const topic = makeTopic();
    const indices = new Set(
      Array.from({ length: 30 }, (_, i) => materializeTemplates(topic, `seed-${i}`)[0].correctIndex)
    );
    expect(indices.size).toBeGreaterThan(1);
  });

  it('returns an empty array for topics without templates', () => {
    const topic = makeTopic();
    delete topic.templates;
    expect(materializeTemplates(topic, 'seed-a')).toEqual([]);
  });

  it('throws a clear error for an unknown generator id', () => {
    const topic = makeTopic();
    topic.templates = [{ generator: 'no-such-generator' }];
    expect(() => materializeTemplates(topic, 'seed-a')).toThrow(/no-such-generator/);
  });
});

describe('templatePlaceholders', () => {
  it('maps template entries to the ids materializeTemplates will use', () => {
    expect(templatePlaceholders(makeTopic())).toEqual([
      { id: 'tpl:0:math-linear-equation', variantOf: 'skill-a' },
      { id: 'tpl:1:phys-fuse-rating' },
    ]);
    expect(templateQuestionId(0, 'math-linear-equation')).toBe('tpl:0:math-linear-equation');
  });

  it('lets computeGroupMastery count generated-question outcomes toward their group', () => {
    const topic = makeTopic();
    const questions = [...topic.questions, ...templatePlaceholders(topic)];
    const attempt = (results: [string, boolean][]): QuizAttempt => ({
      date: new Date().toISOString(),
      correctCount: results.filter(([, c]) => c).length,
      totalCount: results.length,
      questionResults: results.map(([questionId, correct]) => ({ questionId, correct })),
    });
    const mastery = computeGroupMastery(questions, [
      attempt([['tpl:0:math-linear-equation', true]]),
      attempt([['q1', true]]),
    ]);
    // One authored variant + one generated instance of skill-a, both correct.
    expect(mastery.get('skill-a')).toMatchObject({ outcomes: 2, streak: 2, mastered: true });
    // The solo template forms its own group.
    expect(mastery.get('solo:tpl:1:phys-fuse-rating')).toMatchObject({ outcomes: 0, mastered: false });
  });
});
