import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSubject } from '@/content/registry';
import { getContentTopic } from '@/content/registry.content';
import type { Flashcard } from '@/content/types';
import { buildVocabularyQuestions } from '@/lib/vocabulary-quiz';

const cards: Flashcard[] = [
  { id: 'card-1', term: 'der Hund', definition: 'the dog', example: 'Der Hund ist braun.' },
  { id: 'card-2', term: 'die Katze', definition: 'the cat' },
  { id: 'card-3', term: 'das Pferd', definition: 'the horse' },
  { id: 'card-4', term: 'der Vogel', definition: 'the bird' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildVocabularyQuestions', () => {
  it('creates one four-choice question per card with the correct German translation', () => {
    const questions = buildVocabularyQuestions(cards, 'test-seed');

    expect(questions).toHaveLength(cards.length);
    for (const [index, question] of questions.entries()) {
      const card = cards[index];
      expect(question.stem).toBe(`What is “${card.definition}” in German?`);
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices[question.correctIndex]).toBe(card.term);
      for (const choice of question.choices) {
        expect(cards.some((candidate) => candidate.term === choice)).toBe(true);
      }
    }
    expect(questions[0].explanation).toContain('Der Hund ist braun.');
  });

  it('keeps teaching notes out of the English prompt but retains them in the explanation', () => {
    const topic = getContentTopic('german', 'germ-yr7-greetings-basics')!;
    const question = buildVocabularyQuestions(topic.flashcards, 'prompt-test')
      .find((candidate) => candidate.id === 'germ-yr7-greetings-basics-f4-vocab')!;

    expect(question.stem).toBe('What is “My name is...” in German?');
    expect(question.choices[question.correctIndex]).toBe('Ich heiße...');
    expect(question.explanation).toContain('(literally: I am called...)');

    const freetime = getContentTopic('german', 'germ-yr7-freetime-hobbies')!;
    const gladly = buildVocabularyQuestions(freetime.flashcards, 'prompt-test')
      .find((candidate) => candidate.choices[candidate.correctIndex] === 'gern')!;
    expect(gladly.stem).toBe('What is “gladly” in German?');
    expect(gladly.explanation).toContain("added after a verb to mean 'like doing' something");
  });

  it('is deterministic for a seed and does not use unseeded randomness', () => {
    const random = vi.spyOn(Math, 'random');

    expect(buildVocabularyQuestions(cards, 'same-seed')).toEqual(buildVocabularyQuestions(cards, 'same-seed'));
    expect(buildVocabularyQuestions(cards, 'first-seed')).not.toEqual(buildVocabularyQuestions(cards, 'second-seed'));
    expect(random).not.toHaveBeenCalled();
  });

  it('uses concise, comparable German distractors for colour vocabulary', () => {
    const topic = getContentTopic('german', 'germ-yr7-animals-colours')!;
    const question = buildVocabularyQuestions(topic.flashcards, 'colour-test')
      .find((candidate) => candidate.stem === 'What is “red” in German?')!;

    expect(question.choices).toEqual(expect.arrayContaining(['rot', 'blau', 'schwarz']));
    expect(question.choices.every((choice) => !/[;():]/.test(choice))).toBe(true);
    expect(question.choices.every((choice) => choice.length <= 9)).toBe(true);
  });

  it('builds a complete valid quiz from every German topic deck', () => {
    const german = getSubject('german')!;

    for (const meta of german.topics) {
      const topic = getContentTopic('german', meta.id)!;
      const questions = buildVocabularyQuestions(topic.flashcards, `${topic.id}:test`);
      expect(questions, topic.id).toHaveLength(topic.flashcards.length);
      for (const [index, question] of questions.entries()) {
        expect(question.choices, question.id).toHaveLength(4);
        expect(new Set(question.choices).size, question.id).toBe(4);
        expect(question.choices[question.correctIndex], question.id).toBe(topic.flashcards[index].term);
      }
    }
  });
});
