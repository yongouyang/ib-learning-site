import { describe, it, expect } from 'vitest';
import { InMemoryProgressStorage } from '@/lib/progress/dummy';
import { DynamoProgressStorage } from '@/lib/progress/dynamodb-storage';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  FlashcardItem,
  LadderItem,
  ProgressItem,
  ProgressMetaItem,
  ProgressStorage,
  TopicAttemptItem,
  ExamAttemptItem,
} from '@/lib/progress/types';

// Rule 2 (the key test): the in-memory dummy must produce the SAME outcomes
// (attempt booleans, D4 write-signal objects, bucket amounts) and the SAME
// persisted state as the DynamoDB adapter for an identical operation sequence. The simulated DocumentClient below is an
// INDEPENDENT re-implementation of DynamoDB's conditional semantics (it never
// calls the adapter) — items are keyed by (userId, dataType) and each
// condition is evaluated directly. If the dummy's mirror ever drifts from the
// adapter's conditions, the boolean results or the final state diverge here.

const USER_ID = 'u1';
const PROFILE_ID = 'p1';

// --- Simulated DynamoDB (independent re-implementation of the conditions) ----

function simulatedDdb() {
  const items = new Map<string, Record<string, unknown>>();
  const keyOf = (userId: string, dataType: string) => `${userId}\u0000${dataType}`;
  const buckets = new Map<string, number>(); // octav-rate-limits fixed-window counters
  let queryCount = 0;

  const fail = () => {
    const err = new Error('The conditional request failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  };

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'PutCommand') {
      const item = input.Item;
      const k = keyOf(item.userId, item.dataType);

      if (input.ConditionExpression === 'attribute_not_exists(dataType)') {
        // Attempts: append-only, idempotent by SK.
        if (items.has(k)) fail();
        items.set(k, { ...item });
        return {};
      }

      // Flashcards: attribute_not_exists(lastReviewed) OR lastReviewed <= :ts.
      // (A missing item satisfies attribute_not_exists(lastReviewed).)
      // ReturnValues ALL_OLD (D4): the PRE-put item comes back with the write.
      const ts = input.ExpressionAttributeValues[':ts'] as string;
      const existing = items.get(k);
      if (existing && (existing.lastReviewed as string) > ts) fail();
      items.set(k, { ...item });
      return { Attributes: existing };
    }

    if (cmd.constructor.name === 'UpdateCommand') {
      // Rate-limits buckets (octav-rate-limits): keyed by bucket, not
      // userId/dataType.
      if (input.Key.bucket !== undefined) {
        const bucket = input.Key.bucket as string;

        if ((input.UpdateExpression as string).startsWith('ADD #c :delta')) {
          // D4 xpday: daily-cap bucket — `attribute_not_exists(#c) OR #c < :cap`,
          // ReturnValues ALL_NEW. The FULL delta commits while under the cap
          // (the bucket may overshoot by one delta).
          const cap = input.ExpressionAttributeValues[':cap'] as number;
          const delta = input.ExpressionAttributeValues[':delta'] as number;
          const count = buckets.get(bucket) ?? 0;
          if (count >= cap) fail();
          const newCount = count + delta;
          buckets.set(bucket, newCount);
          return { Attributes: { bucket, count: newCount } };
        }

        if ((input.UpdateExpression as string).startsWith('ADD #c :one')) {
          // D4 xp-topic: repeat ordinal — unconditional ADD 1, ALL_NEW.
          const newCount = (buckets.get(bucket) ?? 0) + 1;
          buckets.set(bucket, newCount);
          return { Attributes: { bucket, count: newCount } };
        }

        // Sync-budget bucket: fixed-window counter, `attribute_not_exists(#c)
        // OR #c < :limit`.
        const limit = input.ExpressionAttributeValues[':limit'] as number;
        const count = buckets.get(bucket) ?? 0;
        if (count >= limit) fail();
        buckets.set(bucket, count + 1);
        return {};
      }

      const k = keyOf(input.Key.userId, input.Key.dataType);

      if ((input.UpdateExpression as string).startsWith('SET #lvls.#lvl')) {
        // Ladder: attribute_not_exists(levels.#lvl) OR levels.#lvl.bestScore < :score.
        // ReturnValues ALL_OLD (D4): the PRE-update item comes back with the write.
        const lvl = input.ExpressionAttributeNames['#lvl'] as string;
        const val = input.ExpressionAttributeValues[':val'];
        const score = input.ExpressionAttributeValues[':score'] as number;
        const before = items.get(k);
        const levels = { ...((before?.levels as Record<string, unknown>) ?? {}) };
        const stored = levels[lvl] as { bestScore: number } | undefined;
        if (stored && stored.bestScore >= score) fail();
        levels[lvl] = val;
        items.set(k, {
          ...(before ?? {}),
          userId: input.Key.userId,
          dataType: input.Key.dataType,
          levels,
          profileId: input.ExpressionAttributeValues[':pid'],
          courseId: input.ExpressionAttributeValues[':cid'],
        });
        return { Attributes: before };
      }

      if ((input.UpdateExpression as string).startsWith('SET migrationCompletedAt')) {
        // Migration marker: attribute_not_exists(migrationCompletedAt) — the
        // base META fields are filled with if_not_exists defaults.
        const existing = items.get(k);
        if (existing?.migrationCompletedAt !== undefined) fail();
        items.set(k, {
          ...(existing ?? {}),
          userId: input.Key.userId,
          dataType: input.Key.dataType,
          migrationCompletedAt: input.ExpressionAttributeValues[':at'],
          profileId: input.ExpressionAttributeValues[':pid'],
          totalStars: existing?.totalStars ?? 0,
          currentStreakDays: existing?.currentStreakDays ?? 0,
          lastStudyDate: existing?.lastStudyDate ?? '',
          lastSyncedAt: existing?.lastSyncedAt ?? input.ExpressionAttributeValues[':at'],
        });
        return {};
      }

      // Per-field conditional max set: attribute_not_exists(#f) OR #f < :v.
      const field = input.ExpressionAttributeNames['#f'] as string;
      const value = input.ExpressionAttributeValues[':v'];
      const existing = items.get(k);
      if (existing && existing[field] !== undefined && !((existing[field] as any) < value)) fail();
      items.set(k, {
        ...(existing ?? {}),
        userId: input.Key.userId,
        dataType: input.Key.dataType,
        profileId: input.ExpressionAttributeValues[':pid'],
        lastSyncedAt: input.ExpressionAttributeValues[':now'],
        [field]: value,
      });
      return {};
    }

    if (cmd.constructor.name === 'GetCommand') {
      return { Item: items.get(keyOf(input.Key.userId, input.Key.dataType)) };
    }

    if (cmd.constructor.name === 'QueryCommand') {
      queryCount += 1;
      const prefix = `${input.ExpressionAttributeValues[':userId']}\u0000`;
      const all: Record<string, unknown>[] = [];
      for (const [k, v] of items) {
        if (k.startsWith(prefix)) all.push(v);
      }
      // Round 2: page at 2 items per Query — the adapter's listProgressByUser
      // must loop LastEvaluatedKey to collect the complete set. Without the
      // loop, only the first page would come back and the state below would
      // be truncated (the parity test then fails).
      const startKey = input.ExclusiveStartKey as { dataType: string } | undefined;
      let startIdx = 0;
      if (startKey) {
        const sk = startKey.dataType;
        startIdx = all.findIndex((i) => i.dataType === sk);
        if (startIdx === -1) return { Items: [] };
        startIdx += 1; // ExclusiveStartKey semantics: resume AFTER that key
      }
      const PAGE = 2;
      const page = all.slice(startIdx, startIdx + PAGE);
      if (startIdx + PAGE < all.length) {
        return {
          Items: page,
          LastEvaluatedKey: { userId: input.ExpressionAttributeValues[':userId'], dataType: page[page.length - 1].dataType },
        };
      }
      return { Items: page };
    }

    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return {
    send,
    buckets,
    get queryCount() { return queryCount; },
  } as unknown as DynamoDBDocumentClient & { queryCount: number; buckets: Map<string, number> };
}

// --- Item factories -----------------------------------------------------------

function topicAttempt(attemptId: string): TopicAttemptItem {
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
  };
}

function examAttempt(attemptId: string): ExamAttemptItem {
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
  };
}

function flashcard(date: string, status: 'known' | 'learning', knownStreak: number): FlashcardItem {
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

function ladder(): LadderItem {
  return {
    userId: USER_ID,
    dataType: `LADDER#${PROFILE_ID}#math-y7`,
    profileId: PROFILE_ID,
    courseId: 'math-y7',
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
    lastSyncedAt: 'now',
    ...overrides,
  };
}

// --- One operation sequence, driven against either storage --------------------

async function runSequence(storage: ProgressStorage): Promise<{ results: unknown[]; state: ProgressItem[] }> {
  const results: unknown[] = [];

  // (a) attempt puts incl. duplicate replay.
  results.push(await storage.putTopicAttempt(topicAttempt('a1')));
  results.push(await storage.putTopicAttempt(topicAttempt('a1'))); // replay
  results.push(await storage.putExamAttempt(examAttempt('e1')));
  results.push(await storage.putExamAttempt(examAttempt('e1'))); // replay

  // (b) flashcard older/equal/newer.
  results.push(await storage.putFlashcard(flashcard('2026-08-15T12:00:00.000Z', 'known', 2)));
  results.push(await storage.putFlashcard(flashcard('2026-08-15T11:00:00.000Z', 'learning', 0))); // older
  results.push(await storage.putFlashcard(flashcard('2026-08-15T12:00:00.000Z', 'known', 2))); // equal
  results.push(await storage.putFlashcard(flashcard('2026-08-16T12:00:00.000Z', 'known', 3))); // newer

  // (c) ladder better/equal/worse (+ a second level).
  results.push(await storage.updateLadderLevel(ladder(), 1, 0.5, '2026-08-15T10:00:00.000Z'));
  results.push(await storage.updateLadderLevel(ladder(), 1, 0.9, '2026-08-16T10:00:00.000Z')); // better
  results.push(await storage.updateLadderLevel(ladder(), 1, 0.9, '2026-08-17T10:00:00.000Z')); // equal
  results.push(await storage.updateLadderLevel(ladder(), 1, 0.7, '2026-08-18T10:00:00.000Z')); // worse
  results.push(await storage.updateLadderLevel(ladder(), 2, 0.4, '2026-08-19T10:00:00.000Z')); // new level

  // (d) mergeMeta per-field sequence.
  results.push(
    await storage.mergeMeta(meta({ totalStars: 10, currentStreakDays: 3, lastStudyDate: '2026-08-15T10:00:00.000Z' }))
  );
  results.push(
    await storage.mergeMeta(meta({ totalStars: 2, currentStreakDays: 4, lastStudyDate: '2026-08-15T10:00:00.000Z' }))
  ); // lower stars + higher streak
  results.push(await storage.mergeMeta(meta({ totalStars: 5, currentStreakDays: 2, lastStudyDate: '' }))); // empty date
  results.push(
    await storage.mergeMeta(meta({ totalStars: 10, currentStreakDays: 3, lastStudyDate: '2026-08-15T10:00:00.000Z' }))
  ); // full replay

  // (e) setMigrationCompleted twice.
  results.push(await storage.setMigrationCompleted(USER_ID, PROFILE_ID, '2026-08-20T10:00:00.000Z'));
  results.push(await storage.setMigrationCompleted(USER_ID, PROFILE_ID, '2026-08-21T10:00:00.000Z')); // replay

  return { results, state: await storage.listProgressByUser(USER_ID) };
}

describe('dummy ↔ DynamoDB progress parity (rule 2)', () => {
  it('produces identical boolean results and identical final state across the full sequence', async () => {
    const dummy = await runSequence(new InMemoryProgressStorage());
    const sim = simulatedDdb();
    const ddb = await runSequence(
      new DynamoProgressStorage(
        sim,
        { users: 'u', sessions: 's', progress: 'p', rateLimits: 'rl' },
        { getSession: async () => null, getUserById: async () => null, updateSession: async () => {}, deleteSession: async () => {} }
      )
    );

    // Core parity: every conditional outcome matches (attempt booleans and
    // the D4 write-signal objects alike).
    expect(dummy.results).toEqual(ddb.results);

    // The simulated table pages every 2 items — the adapter MUST have looped
    // LastEvaluatedKey (5 items → 3 Query pages) for the state below to be
    // complete. Without the round-2 pagination loop, only page 1 comes back.
    expect(sim.queryCount).toBeGreaterThanOrEqual(3);

    // State parity, keyed by dataType.
    const byData = (items: ProgressItem[]) => new Map(items.map((i) => [i.dataType, i]));
    const dummyItems = byData(dummy.state);
    const ddbItems = byData(ddb.state);
    expect([...dummyItems.keys()].sort()).toEqual([...ddbItems.keys()].sort());

    // Attempts, flashcards, and META persist IDENTICAL full items.
    for (const key of dummyItems.keys()) {
      if (key.startsWith('LADDER#')) continue;
      expect(ddbItems.get(key)).toEqual(dummyItems.get(key));
    }

    // Ladder: the adapter persists profileId + courseId alongside the levels
    // map (fixed after the round-1 review found it dropped them — the read
    // path keys ladders by courseId), so the full item must match the dummy.
    const ladderKey = [...dummyItems.keys()].find((k) => k.startsWith('LADDER#'))!;
    const dummyLadder = dummyItems.get(ladderKey) as LadderItem;
    const ddbLadder = ddbItems.get(ladderKey) as LadderItem;
    expect(ddbLadder.levels).toEqual(dummyLadder.levels);
    expect(ddbLadder).toEqual({
      userId: USER_ID,
      dataType: ladderKey,
      levels: dummyLadder.levels,
      profileId: PROFILE_ID,
      courseId: 'math-y7',
    });
  });
});

describe('sync-budget parity (dummy ↔ simulated DDB)', () => {
  it('produces identical allow/deny sequences across a window roll', async () => {
    const T0 = Date.parse('2026-08-15T10:00:00Z');
    let now = T0;
    const clock = () => now;
    const sessionSubset = {
      getSession: async () => null,
      getUserById: async () => null,
      updateSession: async () => {},
      deleteSession: async () => {},
    };

    const dummy = new InMemoryProgressStorage(clock);
    const ddb = new DynamoProgressStorage(
      simulatedDdb(),
      { users: 'u', sessions: 's', progress: 'p', rateLimits: 'rl' },
      sessionSubset,
      clock
    );

    const dummyResults: boolean[] = [];
    const ddbResults: boolean[] = [];
    const step = async (storage: ProgressStorage, out: boolean[]) => {
      out.push(await storage.incrementProgressSyncCount(USER_ID, 3, 600));
    };

    // Window 1 (limit 3): allow, allow, allow, deny.
    for (let i = 0; i < 4; i++) {
      await step(dummy, dummyResults);
      await step(ddb, ddbResults);
    }
    // Roll into window 2: fresh bucket → allow, allow.
    now += 601_000;
    for (let i = 0; i < 2; i++) {
      await step(dummy, dummyResults);
      await step(ddb, ddbResults);
    }

    expect(dummyResults).toEqual(ddbResults);
    expect(dummyResults).toEqual([true, true, true, false, true, true]);
  });
});

describe('XP bucket parity (dummy ↔ simulated DDB) — D4', () => {
  const TABLES = { users: 'u', sessions: 's', progress: 'p', rateLimits: 'rl' };
  const sessionSubset = {
    getSession: async () => null,
    getUserById: async () => null,
    updateSession: async () => {},
    deleteSession: async () => {},
  };

  function makePair() {
    const clock = () => Date.parse('2026-08-15T10:00:00Z');
    const sim = simulatedDdb();
    return {
      dummy: new InMemoryProgressStorage(clock),
      ddb: new DynamoProgressStorage(sim, TABLES, sessionSubset, clock),
      sim,
    };
  }

  it('incrementXpDayBucket: identical awarded amounts — boundary clamp, overshoot, at-cap failure, next-day reset', async () => {
    const { dummy, ddb, sim } = makePair();
    const dummyResults: number[] = [];
    const ddbResults: number[] = [];
    const step = async (storage: ProgressStorage, out: number[], delta: number, date = '2026-08-15') =>
      out.push(await storage.incrementXpDayBucket(PROFILE_ID, date, delta, 500));

    // 400 so far + 150 delta → 100 awarded; the bucket commits the FULL 150
    // (documented overshoot to 550 — plan §4.1).
    await step(dummy, dummyResults, 400);
    await step(ddb, ddbResults, 400);
    await step(dummy, dummyResults, 150);
    await step(ddb, ddbResults, 150);
    // At/over the cap → condition failure → 0 awarded (bucket keeps counting).
    await step(dummy, dummyResults, 10);
    await step(ddb, ddbResults, 10);

    expect(dummyResults).toEqual(ddbResults);
    expect(dummyResults).toEqual([400, 100, 0]);
    expect(sim.buckets.get('xpday:p1:2026-08-15')).toBe(550); // overshoot committed

    // A new UTC day is a fresh bucket (the date is IN the key).
    await step(dummy, dummyResults, 10, '2026-08-16');
    await step(ddb, ddbResults, 10, '2026-08-16');
    expect(dummyResults).toEqual(ddbResults);
    expect(dummyResults[3]).toBe(10);
  });

  it('incrementXpDayBucket: bucket isolation per profile', async () => {
    const { dummy, ddb } = makePair();
    for (const storage of [dummy, ddb]) {
      expect(await storage.incrementXpDayBucket('p1', '2026-08-15', 500, 500)).toBe(500);
      expect(await storage.incrementXpDayBucket('p1', '2026-08-15', 1, 500)).toBe(0); // p1 at cap
      expect(await storage.incrementXpDayBucket('p2', '2026-08-15', 1, 500)).toBe(1); // p2 unaffected
    }
  });

  it('incrementXpTopicBucket: identical 1-based ordinals, isolated per profile/topic/week', async () => {
    const { dummy, ddb, sim } = makePair();
    for (const storage of [dummy, ddb]) {
      expect(await storage.incrementXpTopicBucket('p1', 'algebra', '2026-W33')).toBe(1);
      expect(await storage.incrementXpTopicBucket('p1', 'algebra', '2026-W33')).toBe(2);
      expect(await storage.incrementXpTopicBucket('p1', 'algebra', '2026-W33')).toBe(3);
      expect(await storage.incrementXpTopicBucket('p2', 'algebra', '2026-W33')).toBe(1); // other profile
      expect(await storage.incrementXpTopicBucket('p1', 'geometry', '2026-W33')).toBe(1); // other topic
      expect(await storage.incrementXpTopicBucket('p1', 'algebra', '2026-W34')).toBe(1); // other week
    }
    expect(sim.buckets.get('xp-topic:p1:algebra:2026-W33')).toBe(3);
  });
});
