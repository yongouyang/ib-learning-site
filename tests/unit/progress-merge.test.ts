import { describe, it, expect } from 'vitest';
import {
  mergeProfileSnapshot,
  extractLocalEventsForProfile,
  toSyncClientMeta,
  EMPTY_PROFILE_SNAPSHOT,
  type StoredDataLike,
} from '@/lib/progress-merge';
import type { ProfileProgressSnapshot } from '@/lib/progress/types';

const PROFILE_ID = 'p1';

function snapshot(overrides: Partial<ProfileProgressSnapshot> = {}): ProfileProgressSnapshot {
  return structuredClone({ ...EMPTY_PROFILE_SNAPSHOT, ...overrides });
}

function localData(overrides: Partial<StoredDataLike> = {}): StoredDataLike {
  return {
    version: 2,
    userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
    topicProgress: {},
    examResults: [],
    ladderProgress: {},
    flashcardProgress: {},
    ...overrides,
  };
}

const ATTEMPT_A = { attemptId: 'a1', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10 };
const ATTEMPT_B = { attemptId: 'b1', date: '2026-01-02T00:00:00.000Z', correctCount: 8, totalCount: 10 };

describe('mergeProfileSnapshot — topic attempts (union by attemptId)', () => {
  it('keeps server + local attempts without duplicating a shared attemptId', () => {
    const server = snapshot({
      topicProgress: {
        'math:t1': { topicId: 't1', subjectId: 'math', topicTitle: 'Test', subjectTitle: 'Math', attempts: [ATTEMPT_A] },
      },
    });
    const local = localData({
      topicProgress: {
        'math:t1': { topicId: 't1', subjectId: 'math', topicTitle: 'Test', subjectTitle: 'Math', attempts: [ATTEMPT_A, ATTEMPT_B] },
      },
    });

    const { merged, localOnlyEvents } = mergeProfileSnapshot(server, local, PROFILE_ID);

    expect(merged.topicProgress['math:t1'].attempts.map((a) => a.attemptId)).toEqual(['a1', 'b1']);
    // Round 2: ATTEMPT_B is id-bearing but NOT on the server → it is
    // re-uploaded (self-healing for lost queue events). ATTEMPT_A is shared —
    // re-uploaded nothing for it (dedupe-by-attemptId is the guard).
    expect(localOnlyEvents).toHaveLength(1);
    expect(localOnlyEvents[0]).toMatchObject({ type: 'quizAttempt', attemptId: 'b1' });
  });

  it('sorts merged attempts by date ascending', () => {
    const server = snapshot({
      topicProgress: {
        'math:t1': { topicId: 't1', subjectId: 'math', topicTitle: 'Test', subjectTitle: 'Math', attempts: [ATTEMPT_B] },
      },
    });
    const local = localData({
      topicProgress: {
        'math:t1': { topicId: 't1', subjectId: 'math', topicTitle: 'Test', subjectTitle: 'Math', attempts: [ATTEMPT_A] },
      },
    });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.topicProgress['math:t1'].attempts.map((a) => a.date)).toEqual([
      ATTEMPT_A.date,
      ATTEMPT_B.date,
    ]);
  });
});

describe('mergeProfileSnapshot — legacy local attempts', () => {
  it('assigns an id IN PLACE, keeps it, and returns it in localOnlyEvents', () => {
    const server = snapshot({
      topicProgress: {
        'math:t1': { topicId: 't1', subjectId: 'math', topicTitle: 'Test', subjectTitle: 'Math', attempts: [ATTEMPT_A] },
      },
    });
    const local = localData({
      topicProgress: {
        'math:t1': {
          topicId: 't1',
          subjectId: 'math',
          topicTitle: 'Test',
          subjectTitle: 'Math',
          // Legacy attempt: no attemptId.
          attempts: [{ date: '2026-01-03T00:00:00.000Z', correctCount: 9, totalCount: 10 }],
        },
      },
    });

    const { merged, localOnlyEvents } = mergeProfileSnapshot(server, local, PROFILE_ID);

    const attempts = merged.topicProgress['math:t1'].attempts;
    expect(attempts).toHaveLength(2);
    const legacy = attempts.find((a) => a.attemptId !== 'a1');
    expect(legacy).toBeDefined();
    expect(legacy!.attemptId).toBeTruthy();

    expect(localOnlyEvents).toHaveLength(1);
    expect(localOnlyEvents[0]).toMatchObject({
      type: 'quizAttempt',
      profileId: PROFILE_ID,
      attemptId: legacy!.attemptId,
      topicId: 't1',
      subjectId: 'math',
      correctCount: 9,
      totalCount: 10,
    });

    // The id was assigned IN PLACE, so re-merging the same local object is
    // idempotent — the legacy attempt keeps its id and is re-uploaded under
    // THE SAME id (round 2: id-bearing local-only attempts are re-uploaded;
    // no fresh id is minted).
    expect(local.topicProgress['math:t1'].attempts[0].attemptId).toBe(legacy!.attemptId);
    const again = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(again.localOnlyEvents).toHaveLength(1);
    expect((again.localOnlyEvents[0] as { attemptId: string }).attemptId).toBe(legacy!.attemptId);
  });

  it('assigns ids to legacy exams and returns examResult events', () => {
    const server = snapshot({
      examResults: [{ attemptId: 'e1', examId: 'x', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10, secondsUsed: 60 }],
    });
    const local = localData({
      examResults: [{ examId: 'x', date: '2026-01-02T00:00:00.000Z', correctCount: 7, totalCount: 10, secondsUsed: 90 }],
    });

    const { merged, localOnlyEvents } = mergeProfileSnapshot(server, local, PROFILE_ID);

    expect(merged.examResults).toHaveLength(2);
    expect(localOnlyEvents).toHaveLength(1);
    expect(localOnlyEvents[0]).toMatchObject({
      type: 'examResult',
      profileId: PROFILE_ID,
      examId: 'x',
      correctCount: 7,
      secondsUsed: 90,
    });
  });
});

describe('mergeProfileSnapshot — exam results (union by attemptId)', () => {
  it('dedupes shared exam attemptIds and re-uploads local-only id-bearing ones', () => {
    const server = snapshot({
      examResults: [{ attemptId: 'e1', examId: 'x', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10, secondsUsed: 60 }],
    });
    const local = localData({
      examResults: [
        { attemptId: 'e1', examId: 'x', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10, secondsUsed: 60 },
        { attemptId: 'e2', examId: 'x', date: '2026-01-02T00:00:00.000Z', correctCount: 8, totalCount: 10, secondsUsed: 70 },
      ],
    });

    const { merged, localOnlyEvents } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.examResults!.map((e) => e.attemptId)).toEqual(['e1', 'e2']);
    // Round 2: e2 is on the server? No — local-only and id-bearing → re-uploaded.
    expect(localOnlyEvents).toHaveLength(1);
    expect(localOnlyEvents[0]).toMatchObject({ type: 'examResult', attemptId: 'e2' });
  });
});

describe('mergeProfileSnapshot — ladder max(bestScore)', () => {
  it('server wins when its bestScore is higher', () => {
    const server = snapshot({ ladderProgress: { 'math-y7': { '1': { bestScore: 0.8, completedAt: '2026-01-01T00:00:00.000Z' } } } });
    const local = localData({ ladderProgress: { 'math-y7': { 1: { bestScore: 0.5, completedAt: '2026-01-02T00:00:00.000Z' } } } });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.ladderProgress!['math-y7'][1]).toEqual({ bestScore: 0.8, completedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('local wins when its bestScore is higher (completedAt follows the winner)', () => {
    const server = snapshot({ ladderProgress: { 'math-y7': { '1': { bestScore: 0.4, completedAt: '2026-01-01T00:00:00.000Z' } } } });
    const local = localData({ ladderProgress: { 'math-y7': { 1: { bestScore: 0.9, completedAt: '2026-01-03T00:00:00.000Z' } } } });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.ladderProgress!['math-y7'][1]).toEqual({ bestScore: 0.9, completedAt: '2026-01-03T00:00:00.000Z' });
  });
});

describe('mergeProfileSnapshot — flashcards last-write-wins', () => {
  it('server wins when its lastReviewed is later', () => {
    const server = snapshot({ flashcardProgress: { 'c1': { status: 'known', lastReviewed: '2026-01-03T00:00:00.000Z', knownStreak: 3 } } });
    const local = localData({ flashcardProgress: { 'c1': { status: 'learning', lastReviewed: '2026-01-01T00:00:00.000Z', knownStreak: 0 } } });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.flashcardProgress!['c1']).toEqual({ status: 'known', lastReviewed: '2026-01-03T00:00:00.000Z', knownStreak: 3 });
  });

  it('local wins when its lastReviewed is later', () => {
    const server = snapshot({ flashcardProgress: { 'c1': { status: 'learning', lastReviewed: '2026-01-01T00:00:00.000Z', knownStreak: 0 } } });
    const local = localData({ flashcardProgress: { 'c1': { status: 'known', lastReviewed: '2026-01-05T00:00:00.000Z', knownStreak: 5 } } });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.flashcardProgress!['c1']).toEqual({ status: 'known', lastReviewed: '2026-01-05T00:00:00.000Z', knownStreak: 5 });
  });
});

describe('mergeProfileSnapshot — userProgress per-field max', () => {
  it('takes the max per field, with null lastStudyDate as oldest', () => {
    const server = snapshot({
      userProgress: { totalStars: 5, currentStreakDays: 2, lastStudyDate: null },
    });
    const local = localData({
      userProgress: { totalStars: 3, currentStreakDays: 4, lastStudyDate: '2026-01-01T00:00:00.000Z' },
    });

    const { merged } = mergeProfileSnapshot(server, local, PROFILE_ID);
    expect(merged.userProgress).toEqual({
      totalStars: 5,
      currentStreakDays: 4,
      lastStudyDate: '2026-01-01T00:00:00.000Z', // non-null beats null
    });
  });

  it('later lastStudyDate wins when both are set; both-null stays null', () => {
    const a = mergeProfileSnapshot(
      snapshot({ userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: '2026-02-01T00:00:00.000Z' } }),
      localData({ userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: '2026-01-01T00:00:00.000Z' } }),
      PROFILE_ID
    );
    expect(a.merged.userProgress.lastStudyDate).toBe('2026-02-01T00:00:00.000Z');

    const b = mergeProfileSnapshot(
      snapshot({ userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null } }),
      localData({ userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null } }),
      PROFILE_ID
    );
    expect(b.merged.userProgress.lastStudyDate).toBeNull();
  });
});

describe('toSyncClientMeta — wire normalization', () => {
  it('converts the date-only local lastStudyDate to a full ISO datetime', () => {
    expect(toSyncClientMeta({ totalStars: 2, currentStreakDays: 1, lastStudyDate: '2026-01-01' }))
      .toEqual({ totalStars: 2, currentStreakDays: 1, lastStudyDate: '2026-01-01T00:00:00.000Z' });
  });

  it('passes null and already-full datetimes through untouched', () => {
    expect(toSyncClientMeta({ totalStars: 0, currentStreakDays: 0, lastStudyDate: null }).lastStudyDate).toBeNull();
    expect(toSyncClientMeta({ totalStars: 0, currentStreakDays: 0, lastStudyDate: '2026-01-01T10:00:00.000Z' }).lastStudyDate)
      .toBe('2026-01-01T10:00:00.000Z');
  });
});

describe('extractLocalEventsForProfile — migration bulk upload', () => {
  it('converts a full local store into sync events (attempts with ids)', () => {
    const local = localData({
      userProgress: { totalStars: 7, currentStreakDays: 2, lastStudyDate: '2026-01-01T00:00:00.000Z' },
      topicProgress: {
        'math:t1': {
          topicId: 't1',
          subjectId: 'math',
          topicTitle: 'Test',
          subjectTitle: 'Math',
          attempts: [
            { attemptId: 'a1', date: '2026-01-02T00:00:00.000Z', correctCount: 8, totalCount: 10 },
            { attemptId: 'a2', date: '2026-01-03T00:00:00.000Z', correctCount: 5, totalCount: 10, questionResults: [{ questionId: 'q1', correct: true }] },
          ],
        },
      },
      examResults: [{ attemptId: 'e1', examId: 'x', date: '2026-01-01T00:00:00.000Z', correctCount: 4, totalCount: 10, secondsUsed: 100 }],
      ladderProgress: { 'math-y7': { 1: { bestScore: 0.8, completedAt: '2026-01-04T00:00:00.000Z' } } },
      flashcardProgress: { 'c1': { status: 'known', lastReviewed: '2026-01-05T00:00:00.000Z', knownStreak: 3 } },
    });

    const events = extractLocalEventsForProfile(local, PROFILE_ID);

    expect(events).toHaveLength(5); // 2 quiz + 1 exam + 1 ladder + 1 flashcard
    // Deterministic: sorted by date ascending.
    expect(events.map((e) => e.date)).toEqual([
      '2026-01-01T00:00:00.000Z', // exam
      '2026-01-02T00:00:00.000Z', // quiz a1
      '2026-01-03T00:00:00.000Z', // quiz a2
      '2026-01-04T00:00:00.000Z', // ladder
      '2026-01-05T00:00:00.000Z', // flashcard
    ]);

    const quiz = events.find((e) => e.type === 'quizAttempt' && e.attemptId === 'a2');
    expect(quiz).toMatchObject({
      type: 'quizAttempt',
      profileId: PROFILE_ID,
      topicId: 't1',
      subjectId: 'math',
      correctCount: 5,
      questionResults: [{ questionId: 'q1', correct: true }],
    });

    const ladder = events.find((e) => e.type === 'ladderResult');
    expect(ladder).toMatchObject({ courseId: 'math-y7', level: 1, score: 0.8 });

    const flashcard = events.find((e) => e.type === 'flashcardResult');
    expect(flashcard).toMatchObject({ cardId: 'c1', status: 'known', knownStreak: 3 });

    // Idempotent: re-extraction yields the same event list.
    expect(extractLocalEventsForProfile(local, PROFILE_ID)).toEqual(events);
  });

  it('skips attempts/exams that still lack an id (defensive)', () => {
    const local = localData({
      topicProgress: {
        'math:t1': {
          topicId: 't1',
          subjectId: 'math',
          topicTitle: 'Test',
          subjectTitle: 'Math',
          attempts: [{ date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10 }],
        },
      },
      examResults: [{ examId: 'x', date: '2026-01-01T00:00:00.000Z', correctCount: 5, totalCount: 10, secondsUsed: 60 }],
    });

    expect(extractLocalEventsForProfile(local, PROFILE_ID)).toEqual([]);
  });
});
