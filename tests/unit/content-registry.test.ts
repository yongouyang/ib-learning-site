import { describe, it, expect } from 'vitest';
import { getSubjects, getSubject, getTopic } from '@/content/registry';
import type { SubjectId } from '@/content/types';

const EXPECTED_TOPIC_COUNTS: Record<SubjectId, number> = {
  math: 31,
  biology: 5,
  chemistry: 5,
  english: 5,
  physics: 5,
};

describe('content-registry', () => {
  it('should have 5 subjects', () => {
    const subjects = getSubjects();
    expect(subjects).toHaveLength(5);
    expect(subjects.map(s => s.id).sort()).toEqual(['biology', 'chemistry', 'english', 'math', 'physics']);
  });

  it('should get a subject by id', () => {
    const math = getSubject('math');
    expect(math).toBeDefined();
    expect(math!.name).toBe('Math');
  });

  it('should get a topic by subject and topic id', () => {
    const topic = getTopic('math', 'math-yr7-calculations');
    expect(topic).toBeDefined();
    expect(topic!.title).toBe('Written Calculations');
    expect(topic!.notes.length).toBeGreaterThan(0);
    expect(topic!.flashcards.length).toBeGreaterThan(0);
    expect(topic!.questions.length).toBeGreaterThan(0);
  });

  it('should return undefined for unknown subject', () => {
    expect(getSubject('xyz' as any)).toBeUndefined();
  });

  it('should return undefined for unknown topic', () => {
    expect(getTopic('math', 'nonexistent')).toBeUndefined();
  });

  describe('topic counts', () => {
    it.each(Object.entries(EXPECTED_TOPIC_COUNTS))(
      '%s should have %i topics',
      (subjectId, expectedCount) => {
        const subject = getSubject(subjectId as SubjectId);
        expect(subject).toBeDefined();
        expect(subject!.topics).toHaveLength(expectedCount);
      }
    );
  });

  describe('content integrity', () => {
    const subjects = getSubjects();

    it('every topic should have at least 1 note, 1 flashcard, and 1 question', () => {
      for (const subject of subjects) {
        for (const topic of subject.topics) {
          expect(topic.notes.length, `${subject.id}/${topic.id}: notes missing`).toBeGreaterThan(0);
          expect(topic.flashcards.length, `${subject.id}/${topic.id}: flashcards missing`).toBeGreaterThan(0);
          expect(topic.questions.length, `${subject.id}/${topic.id}: questions missing`).toBeGreaterThan(0);
        }
      }
    });

    it('every note should have non-empty heading and body', () => {
      for (const subject of subjects) {
        for (const topic of subject.topics) {
          for (const note of topic.notes) {
            expect(note.heading, `${topic.id}/note ${note.id}: empty heading`).toBeTruthy();
            expect(note.body, `${topic.id}/note ${note.id}: empty body`).toBeTruthy();
          }
        }
      }
    });

    it('every flashcard should have non-empty term and definition', () => {
      for (const subject of subjects) {
        for (const topic of subject.topics) {
          for (const fc of topic.flashcards) {
            expect(fc.term, `${topic.id}/flashcard ${fc.id}: empty term`).toBeTruthy();
            expect(fc.definition, `${topic.id}/flashcard ${fc.id}: empty definition`).toBeTruthy();
          }
        }
      }
    });

    it('every question should have a stem, choices, and valid correctIndex', () => {
      for (const subject of subjects) {
        for (const topic of subject.topics) {
          for (const q of topic.questions) {
            expect(q.stem, `${topic.id}/question ${q.id}: empty stem`).toBeTruthy();
            expect(q.choices.length, `${topic.id}/question ${q.id}: no choices`).toBeGreaterThanOrEqual(2);
            expect(q.choices.length, `${topic.id}/question ${q.id}: too many choices`).toBeLessThanOrEqual(6);
            expect(q.correctIndex, `${topic.id}/question ${q.id}: correctIndex out of range`)
              .toBeGreaterThanOrEqual(0);
            expect(q.correctIndex, `${topic.id}/question ${q.id}: correctIndex out of range`)
              .toBeLessThan(q.choices.length);
            expect(q.explanation, `${topic.id}/question ${q.id}: empty explanation`).toBeTruthy();
          }
        }
      }
    });
  });

  describe('DP-level topics', () => {
    it('math should have DP topics', () => {
      const math = getSubject('math')!;
      const dpTopics = math.topics.filter(t => t.ibLevel === 'DP');
      expect(dpTopics.length).toBeGreaterThanOrEqual(12);
    });

    it('DP topics should be accessible via getTopic', () => {
      const topic = getTopic('math', 'math-dp-sequences');
      expect(topic).toBeDefined();
      expect(topic!.ibLevel).toBe('DP');
      expect(topic!.title).toBe('Sequences & Series');
    });

    it('every topic ibLevel should be MYP or DP', () => {
      for (const subj of getSubjects()) {
        for (const topic of subj.topics) {
          expect(['MYP', 'DP'], `${subj.id}/${topic.id}: invalid ibLevel`).toContain(topic.ibLevel);
        }
      }
    });
  });

  describe('no duplicate topic IDs', () => {
    it('should have unique topic IDs across all subjects', () => {
      const allIds: string[] = [];
      for (const subj of getSubjects()) {
        for (const topic of subj.topics) {
          allIds.push(topic.id);
        }
      }
      const duplicates = allIds.filter((id, idx) => allIds.indexOf(id) !== idx);
      expect(duplicates).toHaveLength(0);
    });
  });
});
