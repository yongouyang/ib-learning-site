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

// Rule 2 (the key test): the in-memory dummy must produce the SAME boolean
// outcomes and the SAME persisted state as the DynamoDB adapter for an
// identical operation sequence. The simulated DocumentClient below is an
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
      const ts = input.ExpressionAttributeValues[':ts'] as string;
      const existing = items.get(k);
      if (existing && (existing.lastReviewed as string) > ts) fail();
      items.set(k, { ...item });
      return {};
    }

    if (cmd.constructor.name === 'UpdateCommand') {
      // Sync-budget bucket (octav-rate-limits): keyed by bucket, not
      // userId/dataType — fixed-window counter, `attribute_not_exists(#c) OR
      // #c < :limit`.
      if (input.Key.bucket !== undefined) {
        const bucket = input.Key.bucket as string;
        const limit = input.ExpressionAttributeValues[':limit'] as number;
        const count = buckets.get(bucket) ?? 0;
        if (count >= limit) fail();
        buckets.set(bucket, count + 1);
        return {};
      }

      const k = keyOf(input.Key.userId, input.Key.dataType);

      if ((input.UpdateExpression as string).startsWith('SET #lvls.#lvl')) {
        // Ladder: attribute_not_exists(levels.#lvl) OR levels.#lvl.bestScore < :score.
        const lvl = input.ExpressionAttributeNames['#lvl'] as string;
        const val = input.ExpressionAttributeValues[':val'];
        const score = input.ExpressionAttributeValues[':score'] as number;
        const existing = items.get(k) ?? {};
        const levels = { ...((existing.levels as Record<string, unknown>) ?? {}) };
        const stored = levels[lvl] as { bestScore: number } | undefined;
        if (stored && stored.bestScore >= score) fail();
        levels[lvl] = val;
        items.set(k, {
          ...existing,
          userId: input.Key.userId,
          dataType: input.Key.dataType,
          levels,
          profileId: input.ExpressionAttributeValues[':pid'],
          courseId: input.ExpressionAttributeValues[':cid'],
        });
        return {};
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

  return { send, get queryCount() { return queryCount; } } as unknown as DynamoDBDocumentClient & { queryCount: number };
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

async function runSequence(storage: ProgressStorage): Promise<{ results: boolean[]; state: ProgressItem[] }> {
  const results: boolean[] = [];

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

    // Core parity: every conditional outcome matches.
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
