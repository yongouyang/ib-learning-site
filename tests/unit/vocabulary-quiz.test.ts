import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSubject } from '@/content/registry';
import { getContentTopic } from '@/content/registry.content';
import type { Flashcard } from '@/content/types';
import { buildVocabularyQuestions, gradeVocabularyAnswer } from '@/lib/vocabulary-quiz';
import { questionResultSchema } from '@/lib/progress/types';

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
  it('creates one typed-answer question per card with the full German term as its answer', () => {
    const questions = buildVocabularyQuestions(cards);

    expect(questions).toHaveLength(cards.length);
    for (const [index, question] of questions.entries()) {
      const card = cards[index];
      expect(question.stem).toBe(`What is “${card.definition}” in German?`);
      expect(question.choices).toEqual([card.term]);
      expect(question.correctIndex).toBe(0);
    }
    expect(questions[0].explanation).toContain('Der Hund ist braun.');
  });

  it('keeps teaching notes out of the English prompt but retains them in the explanation', () => {
    const topic = getContentTopic('german', 'germ-yr7-greetings-basics')!;
    const question = buildVocabularyQuestions(topic.flashcards)
      .find((candidate) => candidate.id === 'germ-yr7-greetings-basics-f4-vocab')!;

    expect(question.stem).toBe('What is “My name is...” in German?');
    expect(question.choices[question.correctIndex]).toBe('Ich heiße...');
    expect(question.explanation).toContain('(literally: I am called...)');

    const freetime = getContentTopic('german', 'germ-yr7-freetime-hobbies')!;
    const gladly = buildVocabularyQuestions(freetime.flashcards)
      .find((candidate) => candidate.choices[candidate.correctIndex] === 'gern')!;
    expect(gladly.stem).toBe('What is “gladly” in German?');
    expect(gladly.explanation).toContain("added after a verb to mean 'like doing' something");
  });

  it('does not use unseeded randomness to invent choices', () => {
    const random = vi.spyOn(Math, 'random');
    expect(buildVocabularyQuestions(cards)).toEqual(buildVocabularyQuestions(cards));
    expect(random).not.toHaveBeenCalled();
  });

  it('builds a complete typed quiz from every German topic deck', () => {
    const german = getSubject('german')!;

    for (const meta of german.topics) {
      const topic = getContentTopic('german', meta.id)!;
      const questions = buildVocabularyQuestions(topic.flashcards);
      expect(questions, topic.id).toHaveLength(topic.flashcards.length);
      for (const [index, question] of questions.entries()) {
        expect(question.choices, question.id).toEqual([topic.flashcards[index].term]);
        expect(question.correctIndex, question.id).toBe(0);
        expect(gradeVocabularyAnswer(topic.flashcards[index].term, topic.flashcards[index].term).correct, question.id).toBe(true);
      }
    }
  });

  it('persists a typed response with its one-answer question snapshot', () => {
    const question = buildVocabularyQuestions(cards)[0];
    const result = questionResultSchema.parse({
      questionId: question.id,
      correct: true,
      selectedIndex: 0,
      textAnswer: 'der Hund',
      answerMode: 'text',
      question,
    });

    expect(result.textAnswer).toBe('der Hund');
    expect(result.answerMode).toBe('text');
    expect(result.question?.choices).toEqual(['der Hund']);
  });
});

describe('gradeVocabularyAnswer', () => {
  it('accepts exact answers with flexible surrounding whitespace and final punctuation', () => {
    expect(gradeVocabularyAnswer('  Guten Tag  ', 'Guten Tag')).toEqual({ correct: true, needsSpellingCheck: false });
    expect(gradeVocabularyAnswer('Woher kommst du', 'Woher kommst du?')).toEqual({ correct: true, needsSpellingCheck: false });
    expect(gradeVocabularyAnswer('Ich heiße', 'Ich heiße...')).toEqual({ correct: true, needsSpellingCheck: false });
  });

  it('awards minor spelling, case and German transliteration differences with a reminder', () => {
    expect(gradeVocabularyAnswer('der Hun', 'der Hund')).toEqual({ correct: true, needsSpellingCheck: true });
    expect(gradeVocabularyAnswer('ich heiße', 'Ich heiße...')).toEqual({ correct: true, needsSpellingCheck: true });
    expect(gradeVocabularyAnswer('Ich heisse', 'Ich heiße...')).toEqual({ correct: true, needsSpellingCheck: true });
    expect(gradeVocabularyAnswer('Herzlichen Glueckwunsch', 'Herzlichen Glückwunsch!')).toEqual({ correct: true, needsSpellingCheck: true });
  });

  it('rejects a missing or wrong article even when the noun is right', () => {
    expect(gradeVocabularyAnswer('Hund', 'der Hund').correct).toBe(false);
    expect(gradeVocabularyAnswer('die Hund', 'der Hund').correct).toBe(false);
    expect(gradeVocabularyAnswer('das Hund', 'der Hund').correct).toBe(false);
    expect(gradeVocabularyAnswer('der Katze', 'die Katze').correct).toBe(false);
  });

  it('requires the complete phrase rather than a fragment or different word', () => {
    expect(gradeVocabularyAnswer('Guten', 'Guten Tag').correct).toBe(false);
    expect(gradeVocabularyAnswer('der Katze', 'der Hund').correct).toBe(false);
    expect(gradeVocabularyAnswer('', 'der Hund').correct).toBe(false);
  });

  it('accepts one complete alternative and optional or parenthetical forms', () => {
    expect(gradeVocabularyAnswer('der Kleiderschrank', 'der Schrank / der Kleiderschrank')).toEqual({ correct: true, needsSpellingCheck: false });
    expect(gradeVocabularyAnswer('die Kleiderschrank', 'der Schrank / der Kleiderschrank').correct).toBe(false);
    expect(gradeVocabularyAnswer('das Fach', 'das (Lieblings)fach').correct).toBe(true);
    expect(gradeVocabularyAnswer('das Lieblingsfach', 'das (Lieblings)fach').correct).toBe(true);
    expect(gradeVocabularyAnswer('fährt los', 'losfahren (fährt los)').correct).toBe(true);
  });

  it('does not split single-word pairs into incomplete answers', () => {
    expect(gradeVocabularyAnswer('billig', 'teuer / billig').correct).toBe(false);
    expect(gradeVocabularyAnswer('teuer / billig', 'teuer / billig').correct).toBe(true);
  });
});
