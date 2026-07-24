import { describe, it, expect } from 'vitest';
import {
  topicSchema,
  subjectMetaSchema,
  conceptNoteSchema,
  flashcardSchema,
  questionSchema,
} from '@/content/schema';
import subjectsMeta from '@/content/data/subjects.json';

const validTopic = {
  id: 'test-topic-1',
  subjectId: 'math',
  title: 'Test Topic',
  description: 'A topic for testing validation.',
  stage: 'ks3',
  notes: [
    { id: 'n1', heading: 'Note 1', body: 'This is a note body.' },
  ],
  flashcards: [
    { id: 'f1', term: 'Term', definition: 'Definition of the term.' },
  ],
  questions: [
    {
      id: 'q1',
      stem: 'What is 2 + 2?',
      choices: ['2', '3', '4', '5'],
      correctIndex: 2,
      explanation: 'Two plus two equals four.',
    },
  ],
};

describe('content schema validation', () => {
  describe('subjects.json', () => {
    it('should validate all subject metadata', () => {
      const result = subjectMetaSchema.array().parse(subjectsMeta);
      expect(result).toHaveLength(5);
      expect(result.map((s) => s.id).sort()).toEqual([
        'biology',
        'chemistry',
        'english',
        'math',
        'physics',
      ]);
    });
  });

  describe('topicSchema', () => {
    it('should accept a valid topic', () => {
      const result = topicSchema.parse(validTopic);
      expect(result.id).toBe('test-topic-1');
      expect(result.stage).toBe('ks3');
    });

    it('should reject a topic with missing id', () => {
      const invalid = { ...validTopic, id: '' };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a topic with invalid subjectId', () => {
      const invalid = { ...validTopic, subjectId: 'history' };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a topic with invalid stage', () => {
      const invalid = { ...validTopic, stage: 'MYP' };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a topic with no notes', () => {
      const invalid = { ...validTopic, notes: [] };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a topic with no flashcards', () => {
      const invalid = { ...validTopic, flashcards: [] };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a topic with no questions', () => {
      const invalid = { ...validTopic, questions: [] };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });

    it('should reject a note with empty heading', () => {
      const invalid = {
        ...validTopic,
        notes: [{ id: 'n1', heading: '', body: 'Body' }],
      };
      expect(() => topicSchema.parse(invalid)).toThrow();
    });
  });

  describe('questionSchema', () => {
    it('should accept a valid question', () => {
      const result = questionSchema.parse(validTopic.questions[0]);
      expect(result.correctIndex).toBe(2);
    });

    it('should reject a question with fewer than 4 choices', () => {
      const invalid = {
        ...validTopic.questions[0],
        choices: ['A', 'B', 'C'],
      };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should reject a question with more than 4 choices', () => {
      const invalid = {
        ...validTopic.questions[0],
        choices: ['A', 'B', 'C', 'D', 'E'],
      };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should reject correctIndex below 0', () => {
      const invalid = { ...validTopic.questions[0], correctIndex: -1 };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should reject correctIndex above 3', () => {
      const invalid = { ...validTopic.questions[0], correctIndex: 4 };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should reject a question with empty explanation', () => {
      const invalid = { ...validTopic.questions[0], explanation: '' };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should accept optional difficulty and calculator tags', () => {
      const result = questionSchema.parse({
        ...validTopic.questions[0],
        difficulty: 'medium',
        calculator: true,
      });
      expect(result.difficulty).toBe('medium');
      expect(result.calculator).toBe(true);
    });

    it('should leave difficulty and calculator undefined when absent', () => {
      const result = questionSchema.parse(validTopic.questions[0]);
      expect(result.difficulty).toBeUndefined();
      expect(result.calculator).toBeUndefined();
    });

    it('should reject an invalid difficulty value', () => {
      const invalid = { ...validTopic.questions[0], difficulty: 'extreme' };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });

    it('should reject a non-boolean calculator value', () => {
      const invalid = { ...validTopic.questions[0], calculator: 'yes' };
      expect(() => questionSchema.parse(invalid)).toThrow();
    });
  });

  describe('flashcardSchema', () => {
    it('should accept a valid flashcard', () => {
      const result = flashcardSchema.parse(validTopic.flashcards[0]);
      expect(result.term).toBe('Term');
    });

    it('should accept a flashcard without an example', () => {
      const flashcard = { id: 'f1', term: 'Term', definition: 'Definition' };
      const result = flashcardSchema.parse(flashcard);
      expect(result.example).toBeUndefined();
    });

    it('should reject a flashcard with empty term', () => {
      const invalid = { ...validTopic.flashcards[0], term: '' };
      expect(() => flashcardSchema.parse(invalid)).toThrow();
    });
  });

  describe('conceptNoteSchema', () => {
    it('should accept a valid note', () => {
      const result = conceptNoteSchema.parse(validTopic.notes[0]);
      expect(result.heading).toBe('Note 1');
    });

    it('should reject a note with empty body', () => {
      const invalid = { ...validTopic.notes[0], body: '' };
      expect(() => conceptNoteSchema.parse(invalid)).toThrow();
    });
  });
});
