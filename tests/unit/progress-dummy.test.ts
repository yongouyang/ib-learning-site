import { describe, it, expect } from 'vitest';
import { InMemoryProgressStorage } from '@/lib/progress/dummy';
import type {
  ExamAttemptItem,
  FlashcardItem,
  LadderItem,
  ProgressMetaItem,
  TopicAttemptItem,
} from '@/lib/progress/types';

// Mirror-semantics tests for the in-memory progress dummy. Every conditional
// write must produce the SAME outcomes the DynamoDB adapter's conditions
// produce (rule 2) — the parity test drives both against a simulated
// DocumentClient; these pin the dummy's standalone behavior directly.

const USER_ID = 'u1';
const PROFILE_ID = 'p1';

function topicAttempt(attemptId: string, overrides: Partial<TopicAttemptItem> = {}): TopicAttemptItem {
  return {
    userId: USER_ID,
    dataType: `TOPIC#${PROFILE_ID}#math:algebra#${attemptId}`,
    profileId: PROFILE_ID,
    attemptId,
    subjectId: 'math',
    topicId: 'algebra',
    topicTitle: 'Algebra',
    subjectTitle: 'Math',
    date: '2026-08-15T10:00:00.000Z',
    correctCount: 7,
    totalCount: 10,
    ...overrides,
  };
}

function examAttempt(attemptId: string, overrides: Partial<ExamAttemptItem> = {}): ExamAttemptItem {
  return {
    userId: USER_ID,
    dataType: `EXAM#${PROFILE_ID}#physics-p1#${attemptId}`,
    profileId: PROFILE_ID,
    attemptId,
    examId: 'physics-p1',
    date: '2026-08-15T10:00:00.000Z',
    correctCount: 12,
    totalCount: 20,
    secondsUsed: 600,
    ...overrides,
  };
}

function flashcard(date: string, status: 'known' | 'learning' = 'known', knownStreak = 2): FlashcardItem {
  return {
    userId: USER_ID,
    dataType: `FLASHCARD#${PROFILE_ID}#card-1`,
    profileId: PROFILE_ID,
    cardId: 'card-1',
    status,
    lastReviewed: date,
    knownStreak,
  };
}

function ladder(courseId = 'math-y7'): LadderItem {
  return {
    userId: USER_ID,
    dataType: `LADDER#${PROFILE_ID}#${courseId}`,
    profileId: PROFILE_ID,
    courseId,
    levels: {},
  };
}

function meta(overrides: Partial<ProgressMetaItem> = {}): ProgressMetaItem {
  return {
    userId: USER_ID,
    dataType: `META#${PROFILE_ID}`,
    profileId: PROFILE_ID,
    totalStars: 0,
    currentStreakDays: 0,
    lastStudyDate: '',
    lastSyncedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryProgressStorage — attempts', () => {
  it('putTopicAttempt/putExamAttempt: duplicate SK → false and the item is NOT replaced', async () => {
    const s = new InMemoryProgressStorage();

    const first = topicAttempt('a1', { correctCount: 7 });
    expect(await s.putTopicAttempt(first)).toBe(true);
    // Same SK (dataType encodes the attemptId), different content.
    expect(await s.putTopicAttempt(topicAttempt('a1', { correctCount: 999 }))).toBe(false);

    const exam = examAttempt('e1', { secondsUsed: 60 });
    expect(await s.putExamAttempt(exam)).toBe(true);
    expect(await s.putExamAttempt(examAttempt('e1', { secondsUsed: 999 }))).toBe(false);

    const items = await s.listProgressByUser(USER_ID);
    const storedTopic = items.find((i) => i.dataType === first.dataType) as TopicAttemptItem;
    const storedExam = items.find((i) => i.dataType === exam.dataType) as ExamAttemptItem;
    expect(storedTopic.correctCount).toBe(7); // original survived the duplicate
    expect(storedExam.secondsUsed).toBe(60);
  });
});

describe('InMemoryProgressStorage — flashcards', () => {
  it('newer overwrites, older returns false leaving the stored copy, equal re-writes true', async () => {
    const s = new InMemoryProgressStorage();

    expect(await s.putFlashcard(flashcard('2026-08-15T12:00:00.000Z', 'known', 2))).toBe(true);

    // Older review must not overwrite a newer one.
    expect(await s.putFlashcard(flashcard('2026-08-15T11:00:00.000Z', 'learning', 0))).toBe(false);
    const afterOlder = (await s.listProgressByUser(USER_ID)).find((i) =>
      i.dataType.startsWith('FLASHCARD#')
    ) as FlashcardItem;
    expect(afterOlder.status).toBe('known');
    expect(afterOlder.knownStreak).toBe(2);
    expect(afterOlder.lastReviewed).toBe('2026-08-15T12:00:00.000Z');

    // Equal timestamp re-writes the same values (idempotent replay) → true.
    expect(await s.putFlashcard(flashcard('2026-08-15T12:00:00.000Z', 'known', 2))).toBe(true);

    // Newer overwrites.
    expect(await s.putFlashcard(flashcard('2026-08-16T12:00:00.000Z', 'known', 3))).toBe(true);
    const final = (await s.listProgressByUser(USER_ID)).find((i) =>
      i.dataType.startsWith('FLASHCARD#')
    ) as FlashcardItem;
    expect(final.knownStreak).toBe(3);
    expect(final.lastReviewed).toBe('2026-08-16T12:00:00.000Z');
  });
});

describe('InMemoryProgressStorage — ladder', () => {
  it('missing level sets, better overwrites, equal/worse returns false (no regression)', async () => {
    const s = new InMemoryProgressStorage();
    const item = ladder();

    expect(await s.updateLadderLevel(item, 1, 0.5, 'd1')).toBe(true); // missing → set
    expect(await s.updateLadderLevel(item, 1, 0.9, 'd2')).toBe(true); // better → overwrite
    expect(await s.updateLadderLevel(item, 1, 0.9, 'd3')).toBe(false); // equal → false
    expect(await s.updateLadderLevel(item, 1, 0.7, 'd4')).toBe(false); // worse → false

    const stored = (await s.listProgressByUser(USER_ID)).find(
      (i) => i.dataType === item.dataType
    ) as LadderItem;
    expect(stored.levels['1']).toEqual({ bestScore: 0.9, completedAt: 'd2' });
  });
});

describe('InMemoryProgressStorage — meta', () => {
  it('mergeMeta: per-field max keeps BOTH maxes (lower stars + higher streak)', async () => {
    const s = new InMemoryProgressStorage();
    expect(
      await s.mergeMeta(meta({ totalStars: 10, currentStreakDays: 3, lastStudyDate: '2026-08-15T10:00:00.000Z' }))
    ).toBe(true);

    // Lower stars must not regress the stored stars, even while the streak improves.
    expect(
      await s.mergeMeta(meta({ totalStars: 2, currentStreakDays: 4, lastStudyDate: '2026-08-15T10:00:00.000Z' }))
    ).toBe(true);

    const stored = await s.getMeta(USER_ID, PROFILE_ID);
    expect(stored?.totalStars).toBe(10); // max kept
    expect(stored?.currentStreakDays).toBe(4); // newer streak applied
  });

  it('mergeMeta: empty incoming lastStudyDate never regresses a stored date', async () => {
    const s = new InMemoryProgressStorage();
    await s.mergeMeta(meta({ totalStars: 1, currentStreakDays: 1, lastStudyDate: '2026-08-20T00:00:00.000Z' }));

    expect(await s.mergeMeta(meta({ totalStars: 0, currentStreakDays: 0, lastStudyDate: '' }))).toBe(false);
    expect((await s.getMeta(USER_ID, PROFILE_ID))?.lastStudyDate).toBe('2026-08-20T00:00:00.000Z');
  });

  it('mergeMeta returns false when nothing improves (equal values)', async () => {
    const s = new InMemoryProgressStorage();
    const item = meta({ totalStars: 5, currentStreakDays: 2, lastStudyDate: '2026-08-15T00:00:00.000Z' });
    expect(await s.mergeMeta(item)).toBe(true);
    expect(await s.mergeMeta(item)).toBe(false);
  });

  it('getMeta returns null when absent', async () => {
    const s = new InMemoryProgressStorage();
    expect(await s.getMeta(USER_ID, PROFILE_ID)).toBeNull();
  });
});

describe('InMemoryProgressStorage — migration marker', () => {
  it('setMigrationCompleted: true once, false on replay', async () => {
    const s = new InMemoryProgressStorage();
    expect(await s.setMigrationCompleted(USER_ID, PROFILE_ID, '2026-08-20T00:00:00.000Z')).toBe(true);
    expect(await s.setMigrationCompleted(USER_ID, PROFILE_ID, '2026-08-21T00:00:00.000Z')).toBe(false);
    expect((await s.getMeta(USER_ID, PROFILE_ID))?.migrationCompletedAt).toBe('2026-08-20T00:00:00.000Z');
  });
});

describe('InMemoryProgressStorage — listing/deletion', () => {
  it('listProgressByUser returns seeded items and deleteProgressByUser clears them', async () => {
    const s = new InMemoryProgressStorage();
    await s.putTopicAttempt(topicAttempt('a1'));
    await s.putFlashcard(flashcard('2026-08-15T00:00:00.000Z'));
    expect(await s.listProgressByUser(USER_ID)).toHaveLength(2);

    await s.deleteProgressByUser(USER_ID);
    expect(await s.listProgressByUser(USER_ID)).toEqual([]);
  });
});

describe('InMemoryProgressStorage — durable sync budget', () => {
  it('incrementProgressSyncCount enforces a fixed-window budget and resets atomically on rollover', async () => {
    let now = Date.parse('2026-08-15T10:00:00Z');
    const s = new InMemoryProgressStorage(() => now);
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(true);
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(true);
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(false); // budget spent
    now += 601_000; // next fixed window → fresh bucket
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(true);
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(true);
    expect(await s.incrementProgressSyncCount('u1', 2, 600)).toBe(false); // spent again
  });

  it('budget is per-user (a second user has their own bucket)', async () => {
    const s = new InMemoryProgressStorage();
    expect(await s.incrementProgressSyncCount('u1', 1, 600)).toBe(true);
    expect(await s.incrementProgressSyncCount('u1', 1, 600)).toBe(false);
    expect(await s.incrementProgressSyncCount('u2', 1, 600)).toBe(true);
  });
});
