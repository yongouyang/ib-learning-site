import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setActiveNamespace,
  setSyncEventHook,
  loadStoredData,
  loadAnonymousData,
  saveAnonymousData,
  assignMissingAttemptIds,
  recordQuizAttempt,
  recordExamResult,
  recordLadderResult,
  recordFlashcardResult,
  getUserProgress,
  getAllTopicProgress,
} from '@/lib/progress-store';
import type { ProgressEvent } from '@/lib/progress/types';

// Mock localStorage (same pattern as progress-store.test.ts).
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
  setActiveNamespace(null, null);
  setSyncEventHook(null);
});

describe('progress-store namespace routing', () => {
  it('routes load/save to the namespaced key when a namespace is active', () => {
    setActiveNamespace('u1', 'p1');
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);

    const namespaced = JSON.parse(store['octav_progress:u1:p1']);
    expect(namespaced.topicProgress['math:t1'].attempts).toHaveLength(1);
    // Anonymous store is untouched.
    expect(store['iblearn_progress']).toBeUndefined();
    // Getters read the namespaced store.
    expect(getUserProgress().totalStars).toBe(2);
    expect(getAllTopicProgress()).toHaveLength(1);
  });

  it('routes back to the anonymous iblearn_progress key when null', () => {
    setActiveNamespace('u1', 'p1');
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);
    expect(store['octav_progress:u1:p1']).toBeDefined();

    setActiveNamespace(null, null);
    recordQuizAttempt('t2', 'math', 'Test 2', 'Math', 5, 10);

    expect(JSON.parse(store['iblearn_progress']).topicProgress['math:t2'].attempts).toHaveLength(1);
    // The namespaced store is unchanged by the anonymous write.
    expect(JSON.parse(store['octav_progress:u1:p1']).topicProgress['math:t1'].attempts).toHaveLength(1);
  });

  it('keeps the anonymous store byte-for-byte unchanged when logged out', () => {
    setActiveNamespace(null, null);
    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);

    const raw = JSON.parse(store['iblearn_progress']);
    expect(raw.version).toBe(2);
    expect(raw.userProgress.totalStars).toBe(2);
    expect(raw.userProgress.currentStreakDays).toBe(1);

    const attempt = raw.topicProgress['math:t1'].attempts[0];
    // No attemptId is added to the anonymous blob.
    expect(attempt.attemptId).toBeUndefined();
    expect(Object.keys(attempt).sort()).toEqual(['correctCount', 'date', 'totalCount']);
  });

  it('loadAnonymousData reads the anonymous blob even with a namespace active', () => {
    store['iblearn_progress'] = JSON.stringify({
      version: 2,
      userProgress: { totalStars: 5, currentStreakDays: 2, lastStudyDate: '2026-07-01' },
      topicProgress: {},
      examResults: [],
      ladderProgress: {},
      flashcardProgress: {},
    });
    setActiveNamespace('u1', 'p1');

    expect(loadAnonymousData().userProgress.totalStars).toBe(5);
    expect(loadStoredData().userProgress.totalStars).toBe(0); // namespaced is fresh
  });
});

describe('assignMissingAttemptIds', () => {
  const idLessBlob = () =>
    JSON.stringify({
      version: 2,
      userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
      topicProgress: {
        'math:t1': {
          topicId: 't1',
          subjectId: 'math',
          topicTitle: 'Test',
          subjectTitle: 'Math',
          attempts: [
            { attemptId: 'existing', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10 },
            { date: '2026-01-02T00:00:00.000Z', correctCount: 8, totalCount: 10 },
          ],
        },
      },
      examResults: [
        { examId: 'x', date: '2026-01-03T00:00:00.000Z', correctCount: 5, totalCount: 10, secondsUsed: 60 },
      ],
      ladderProgress: {},
      flashcardProgress: {},
    });

  it('fills only missing ids and stays PURE (round 2: no active-store write)', () => {
    setActiveNamespace('u1', 'p1');
    store['octav_progress:u1:p1'] = idLessBlob();
    const rawBefore = store['octav_progress:u1:p1'];

    const data = loadStoredData();
    assignMissingAttemptIds(data);

    const attempts = data.topicProgress['math:t1'].attempts;
    expect(attempts[0].attemptId).toBe('existing'); // never replaced
    expect(attempts[1].attemptId).toBeTruthy();
    expect(attempts[1].attemptId).not.toBe('existing');
    expect(data.examResults![0].attemptId).toBeTruthy();

    // The active namespaced store is untouched — the caller decides which
    // store to persist (the login migration persists to the anonymous blob,
    // never over the just-merged namespaced data).
    expect(store['octav_progress:u1:p1']).toBe(rawBefore);
  });

  it('saveAnonymousData persists the assigned ids to the anon blob only', () => {
    setActiveNamespace('u1', 'p1');
    store['iblearn_progress'] = idLessBlob();
    store['octav_progress:u1:p1'] = idLessBlob();
    const namespacedBefore = store['octav_progress:u1:p1'];

    const anon = assignMissingAttemptIds(loadAnonymousData());
    saveAnonymousData(anon);

    // The anonymous blob carries the ids so a retried migration reuses them.
    const savedAnon = JSON.parse(store['iblearn_progress']);
    expect(savedAnon.topicProgress['math:t1'].attempts[1].attemptId).toBeTruthy();
    expect(savedAnon.examResults[0].attemptId).toBeTruthy();

    // The namespaced store was NOT overwritten with anon content.
    expect(store['octav_progress:u1:p1']).toBe(namespacedBefore);
  });
});

describe('progress-store sync enqueue hook', () => {
  it('calls the hook with attemptId + profileId + local timestamp when active', () => {
    const events: ProgressEvent[] = [];
    setSyncEventHook((e) => events.push(e));
    setActiveNamespace('u1', 'p1');

    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'quizAttempt',
      profileId: 'p1',
      topicId: 't1',
      subjectId: 'math',
      topicTitle: 'Test',
      subjectTitle: 'Math',
      correctCount: 8,
      totalCount: 10,
    });
    expect((events[0] as { attemptId: string }).attemptId).toBeTruthy();
  });

  it('records the exam event with an attemptId and the stored date', () => {
    const events: ProgressEvent[] = [];
    setSyncEventHook((e) => events.push(e));
    setActiveNamespace('u1', 'p1');
    const date = '2026-01-05T00:00:00.000Z';

    recordExamResult({ examId: 'math-y7:paper-1', date, correctCount: 9, totalCount: 10, secondsUsed: 120 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'examResult', profileId: 'p1', examId: 'math-y7:paper-1', correctCount: 9, secondsUsed: 120, date });
  });

  it('records the ladder event with the FINAL bestScore (max applied locally)', () => {
    const events: ProgressEvent[] = [];
    setSyncEventHook((e) => events.push(e));
    setActiveNamespace('u1', 'p1');

    recordLadderResult('math-y7', 1, 0.5);
    recordLadderResult('math-y7', 1, 0.8);

    const ladder = events.filter((e) => e.type === 'ladderResult');
    expect(ladder).toHaveLength(2);
    expect(ladder[1]).toMatchObject({ type: 'ladderResult', profileId: 'p1', courseId: 'math-y7', level: 1, score: 0.8 });
  });

  it('records the flashcard event with the final knownStreak and review timestamp', () => {
    const events: ProgressEvent[] = [];
    setSyncEventHook((e) => events.push(e));
    setActiveNamespace('u1', 'p1');

    recordFlashcardResult('c1', 'known');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'flashcardResult', profileId: 'p1', cardId: 'c1', status: 'known', knownStreak: 1 });
  });

  it('does not enqueue when logged out (no active namespace)', () => {
    const spy = vi.fn();
    setSyncEventHook(spy);
    setActiveNamespace(null, null);

    recordQuizAttempt('t1', 'math', 'Test', 'Math', 8, 10);
    expect(spy).not.toHaveBeenCalled();
  });
});
