import { describe, it, expect } from 'vitest';
import { getSubjects, getSubject, getTopic } from '@/content/registry';
import {
  getAllContentTopics,
  getContentSubject,
  getContentSubjects,
  getContentTopic,
} from '@/content/registry.content';
import type { TopicMeta } from '@/content/types';
import { getAllPapersContent, getPaperContent, getPapersForCourseContent } from '@/content/registry.papers';
import type { SubjectId } from '@/content/types';

const EXPECTED_TOPIC_COUNTS: Partial<Record<SubjectId, number>> = {
  math: 104,
  biology: 14,
  chemistry: 13,
  english: 34,
  physics: 14,
  geography: 10,
  history: 11,
  ict: 12,
  chinese: 20,
  german: 13,
};

describe('content-registry', () => {
  it('should have 10 subjects', () => {
    const subjects = getSubjects();
    expect(subjects).toHaveLength(10);
    expect(subjects.map(s => s.id).sort()).toEqual([
      'biology', 'chemistry', 'chinese', 'english', 'geography',
      'german', 'history', 'ict', 'math', 'physics',
    ]);
  });

  it('should get a subject by id', () => {
    const math = getSubject('math');
    expect(math).toBeDefined();
    expect(math!.name).toBe('Math');
  });

  it('should get a topic by subject and topic id (metadata)', () => {
    const topic = getTopic('math', 'math-yr7-calculations');
    expect(topic).toBeDefined();
    expect(topic!.title).toBe('Written Calculations');
    expect(topic!.noteCount).toBeGreaterThan(0);
    expect(topic!.flashcardCount).toBeGreaterThan(0);
    expect(topic!.questionCount).toBeGreaterThan(0);
  });

  it('should return undefined for unknown subject', () => {
    expect(getSubject('xyz' as any)).toBeUndefined();
  });

  it('should return undefined for unknown topic', () => {
    expect(getTopic('math', 'nonexistent')).toBeUndefined();
  });

  describe('content halves (Phase 1a — docs/premium-content-protection-plan.md §4.4)', () => {
    it('registry.content exposes the topic bodies, registry.ts only the metadata', () => {
      const meta = getTopic('math', 'math-yr7-calculations');
      const content = getContentTopic('math', 'math-yr7-calculations');
      // The split's whole point: metadata has no bodies, content has no literals to drift from.
      expect(meta).not.toHaveProperty('questions');
      expect(meta).not.toHaveProperty('notes');
      expect(content!.id).toBe(meta!.id);
      expect(content!.questions.length).toBe(meta!.questionCount);
      expect(getContentTopic('math', 'nonexistent')).toBeUndefined();
      expect(getContentSubject('math')!.topics).toHaveLength(EXPECTED_TOPIC_COUNTS.math!);
      expect(getAllContentTopics()).toHaveLength(Object.values(EXPECTED_TOPIC_COUNTS).reduce((a, b) => a + b, 0));
    });

    it('registry.papers exposes papers with their mark schemes', () => {
      const papers = getAllPapersContent();
      expect(papers).toHaveLength(31);
      const set = getPaperContent('math-y9', 'math-y9-set-2')!;
      expect(set.questions.length).toBeGreaterThan(0);
      expect(set.questions[0].markscheme.length).toBe(set.questions[0].marks);
      expect(getPaperContent('math-y9', 'nope')).toBeUndefined();
      expect(getPapersForCourseContent('math-y9').every((p) => p.courseId === 'math-y9')).toBe(true);
    });
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

  describe('metadata integrity', () => {
    const subjects = getSubjects();

    it('every topic meta carries the counts its consumers read', () => {
      for (const subject of subjects) {
        for (const topic of subject.topics) {
          expect(topic.noteCount, `${topic.id}: noteCount`).toBeGreaterThan(0);
          expect(topic.flashcardCount, `${topic.id}: flashcardCount`).toBe(topic.flashcardIds.length);
          expect(topic.questionCount, `${topic.id}: questionCount`).toBeGreaterThan(0);
        }
      }
    });

    it('metadata and content agree (the counts are not stale literals)', () => {
      for (const topic of getAllContentTopics()) {
        const meta = getTopic(topic.subjectId, topic.id) as TopicMeta | undefined;
        expect(meta, `${topic.id}: missing metadata`).toBeDefined();
        expect(meta!.noteCount).toBe(topic.notes.length);
        expect(meta!.flashcardCount).toBe(topic.flashcards.length);
        expect(meta!.questionCount).toBe(topic.questions.length);
        expect(meta!.flashcardIds).toEqual(topic.flashcards.map((c) => c.id));
        expect(meta!.title).toBe(topic.title);
        expect(meta!.description).toBe(topic.description);
      }
    });
  });

  describe('content integrity (registry.content — server-side)', () => {
    const subjects = getContentSubjects();

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
      const dpTopics = math.topics.filter(t => t.stage === 'dp');
      expect(dpTopics.length).toBeGreaterThanOrEqual(18);
    });

    it('DP topics should be accessible via getTopic', () => {
      const topic = getTopic('math', 'math-dp-ai-sequences');
      expect(topic).toBeDefined();
      expect(topic!.stage).toBe('dp');
      expect(topic!.course).toBe('ai');
      expect(topic!.title).toBe('Sequences & Series');
    });

    it('every topic stage should be ks3, igcse or dp', () => {
      for (const subj of getSubjects()) {
        for (const topic of subj.topics) {
          expect(['ks3', 'igcse', 'dp'], `${subj.id}/${topic.id}: invalid stage`).toContain(topic.stage);
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
