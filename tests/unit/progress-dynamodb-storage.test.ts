import { describe, it, expect, vi } from 'vitest';
import { DynamoProgressStorage } from '@/lib/progress/dynamodb-storage';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '@/lib/auth/types';
import type {
  ExamAttemptItem,
  FlashcardItem,
  LadderItem,
  ProgressMetaItem,
  TopicAttemptItem,
} from '@/lib/progress/types';

// Adapter tests with a mock DocumentClient: assert the commands the adapter
// sends (table names, keys, expressions, conditions) — no AWS involved. The
// real client wiring lives in deps.ts and is exercised by the Lambda in
// production.

interface CommandLike {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function mockClient(handler?: (cmd: CommandLike) => unknown): DynamoDBDocumentClient {
  return {
    send: async (cmd: unknown) => {
      const result = handler?.(cmd as CommandLike);
      return result === undefined ? {} : result;
    },
  } as unknown as DynamoDBDocumentClient;
}

const TABLES = { users: 'octav-users', sessions: 'octav-sessions', progress: 'octav-progress' };

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  return new DynamoProgressStorage(mockClient(handler), TABLES, {
    getSession: async () => null,
    getUserById: async () => null,
    updateSession: async () => {},
    deleteSession: async () => {},
  });
}

function conditionalFailure(): Error {
  const err = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  return err;
}

const USER_ID = 'u1';
const PROFILE_ID = 'p1';

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

function flashcard(date: string): FlashcardItem {
  return {
    userId: USER_ID,
    dataType: `FLASHCARD#${PROFILE_ID}#card-1`,
    profileId: PROFILE_ID,
    cardId: 'card-1',
    status: 'known',
    lastReviewed: date,
    knownStreak: 2,
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
    totalStars: 10,
    currentStreakDays: 3,
    lastStudyDate: '2026-08-15T10:00:00.000Z',
    lastSyncedAt: 'now',
    ...overrides,
  };
}

describe('DynamoProgressStorage — command shapes', () => {
  it('putTopicAttempt/putExamAttempt send conditional Puts with attribute_not_exists(dataType)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    expect(await s.putTopicAttempt(topicAttempt('a1'))).toBe(true);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Item: topicAttempt('a1'),
      ConditionExpression: 'attribute_not_exists(dataType)',
    });

    expect(await s.putExamAttempt(examAttempt('e1'))).toBe(true);
    expect(calls[1].input).toEqual({
      TableName: 'octav-progress',
      Item: examAttempt('e1'),
      ConditionExpression: 'attribute_not_exists(dataType)',
    });
  });

  it('putFlashcard sends a monotonic lastReviewed condition', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    const item = flashcard('2026-08-15T10:00:00.000Z');
    expect(await s.putFlashcard(item)).toBe(true);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Item: item,
      ConditionExpression: 'attribute_not_exists(lastReviewed) OR lastReviewed <= :ts',
      ExpressionAttributeValues: { ':ts': '2026-08-15T10:00:00.000Z' },
    });
  });

  it('updateLadderLevel sends a max-wins Update on levels.#lvl', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    expect(await s.updateLadderLevel(ladder(), 3, 0.75, '2026-08-16T10:00:00.000Z')).toBe(true);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Key: { userId: USER_ID, dataType: `LADDER#${PROFILE_ID}#math-y7` },
      UpdateExpression: 'SET #lvls.#lvl = :val, profileId = :pid, courseId = :cid',
      ConditionExpression: 'attribute_not_exists(#lvls.#lvl) OR #lvls.#lvl.bestScore < :score',
      ExpressionAttributeNames: { '#lvls': 'levels', '#lvl': '3' },
      ExpressionAttributeValues: {
        ':val': { bestScore: 0.75, completedAt: '2026-08-16T10:00:00.000Z' },
        ':score': 0.75,
        ':pid': PROFILE_ID,
        ':cid': 'math-y7',
      },
    });
  });

  it('mergeMeta sends one conditional max update per field', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    expect(await s.mergeMeta(meta())).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Key: { userId: USER_ID, dataType: `META#${PROFILE_ID}` },
      UpdateExpression: 'SET #f = :v, profileId = :pid, lastSyncedAt = :now',
      ConditionExpression: 'attribute_not_exists(#f) OR #f < :v',
      ExpressionAttributeNames: { '#f': 'totalStars' },
      ExpressionAttributeValues: { ':v': 10, ':pid': PROFILE_ID, ':now': 'now' },
    });
    expect(calls[1].input).toMatchObject({
      ExpressionAttributeNames: { '#f': 'currentStreakDays' },
      ExpressionAttributeValues: { ':v': 3 },
    });
    expect(calls[2].input).toMatchObject({
      ExpressionAttributeNames: { '#f': 'lastStudyDate' },
      ExpressionAttributeValues: { ':v': '2026-08-15T10:00:00.000Z' },
    });
  });

  it('mergeMeta skips an empty lastStudyDate (no update for that field)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.mergeMeta(meta({ lastStudyDate: '' }));
    const fields = calls.map((c) => (c.input.ExpressionAttributeNames as Record<string, string>)['#f']);
    expect(fields).toEqual(['totalStars', 'currentStreakDays']);
  });

  it('setMigrationCompleted sends an exactly-once marker update', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    expect(await s.setMigrationCompleted(USER_ID, PROFILE_ID, '2026-08-20T00:00:00.000Z')).toBe(true);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Key: { userId: USER_ID, dataType: `META#${PROFILE_ID}` },
      UpdateExpression:
        'SET migrationCompletedAt = :at, profileId = :pid, totalStars = if_not_exists(totalStars, :zero), currentStreakDays = if_not_exists(currentStreakDays, :zero), lastStudyDate = if_not_exists(lastStudyDate, :empty), lastSyncedAt = if_not_exists(lastSyncedAt, :at)',
      ConditionExpression: 'attribute_not_exists(migrationCompletedAt)',
      ExpressionAttributeValues: {
        ':at': '2026-08-20T00:00:00.000Z',
        ':pid': PROFILE_ID,
        ':zero': 0,
        ':empty': '',
      },
    });
  });

  it('getMeta uses GetCommand; listProgressByUser uses QueryCommand by userId', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'GetCommand') return { Item: { userId: USER_ID, dataType: `META#${PROFILE_ID}` } };
      if (cmd.constructor.name === 'QueryCommand') return { Items: [{ userId: USER_ID, dataType: 'TOPIC#x' }] };
      return {};
    });
    const m = await s.getMeta(USER_ID, PROFILE_ID);
    expect(m?.dataType).toBe(`META#${PROFILE_ID}`);
    expect(calls[0].input).toEqual({
      TableName: 'octav-progress',
      Key: { userId: USER_ID, dataType: `META#${PROFILE_ID}` },
    });

    const items = await s.listProgressByUser(USER_ID);
    expect(items).toHaveLength(1);
    expect(calls[1].input).toEqual({
      TableName: 'octav-progress',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': USER_ID },
    });
  });

  it('getMeta returns null on an empty result', async () => {
    const s = makeStorage(() => ({}));
    expect(await s.getMeta(USER_ID, PROFILE_ID)).toBeNull();
  });

  it('listProgressByUser loops LastEvaluatedKey pages until exhausted (round 2)', async () => {
    const queries: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      queries.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        if (queries.length === 1) {
          return {
            Items: [
              { userId: USER_ID, dataType: 'TOPIC#p1#a1' },
              { userId: USER_ID, dataType: 'TOPIC#p1#a2' },
            ],
            LastEvaluatedKey: { userId: USER_ID, dataType: 'TOPIC#p1#a2' },
          };
        }
        if (queries.length === 2) {
          return {
            Items: [{ userId: USER_ID, dataType: 'EXAM#p1#e1' }],
            LastEvaluatedKey: { userId: USER_ID, dataType: 'EXAM#p1#e1' },
          };
        }
        // Final page: no LastEvaluatedKey → the loop must stop.
        return { Items: [{ userId: USER_ID, dataType: 'FLASHCARD#p1#c1' }] };
      }
      return {};
    });

    const items = await s.listProgressByUser(USER_ID);

    // Every page was collected, in order.
    expect(items.map((i) => i.dataType)).toEqual(['TOPIC#p1#a1', 'TOPIC#p1#a2', 'EXAM#p1#e1', 'FLASHCARD#p1#c1']);
    expect(queries).toHaveLength(3);
    // The first page has no ExclusiveStartKey; later pages echo the previous LastEvaluatedKey.
    expect(queries[0].input.ExclusiveStartKey).toBeUndefined();
    expect(queries[1].input.ExclusiveStartKey).toEqual({ userId: USER_ID, dataType: 'TOPIC#p1#a2' });
    expect(queries[2].input.ExclusiveStartKey).toEqual({ userId: USER_ID, dataType: 'EXAM#p1#e1' });
  });

  it('deleteProgressByUser deletes items from EVERY page (no truncation)', async () => {
    const calls: CommandLike[] = [];
    let queryCount = 0;
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        queryCount += 1;
        if (queryCount === 1) {
          return {
            Items: [
              { userId: USER_ID, dataType: 'TOPIC#a' },
              { userId: USER_ID, dataType: 'TOPIC#b' },
            ],
            LastEvaluatedKey: { userId: USER_ID, dataType: 'TOPIC#b' },
          };
        }
        return { Items: [{ userId: USER_ID, dataType: 'FLASHCARD#c' }] };
      }
      return {};
    });

    await s.deleteProgressByUser(USER_ID);

    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes.map((d) => (d.input.Key as { dataType: string }).dataType)).toEqual([
      'TOPIC#a',
      'TOPIC#b',
      'FLASHCARD#c',
    ]);
  });

  it('deleteProgressByUser deletes each item via its key', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        return {
          Items: [
            { userId: USER_ID, dataType: 'TOPIC#a' },
            { userId: USER_ID, dataType: 'FLASHCARD#b' },
          ],
        };
      }
      return {};
    });
    await s.deleteProgressByUser(USER_ID);
    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes).toHaveLength(2);
    expect(deletes[0].input).toEqual({ TableName: 'octav-progress', Key: { userId: USER_ID, dataType: 'TOPIC#a' } });
    expect(deletes[1].input).toEqual({ TableName: 'octav-progress', Key: { userId: USER_ID, dataType: 'FLASHCARD#b' } });
  });

  it('progress ops never set ReturnValues (unlike the auth adapter)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.putTopicAttempt(topicAttempt('a1'));
    await s.updateLadderLevel(ladder(), 1, 0.5, 'd1');
    await s.mergeMeta(meta());
    await s.setMigrationCompleted(USER_ID, PROFILE_ID, 'd2');
    expect(calls.every((c) => c.input.ReturnValues === undefined)).toBe(true);
  });
});

describe('DynamoProgressStorage — conditional-failure paths', () => {
  it('putTopicAttempt/putExamAttempt return false on a duplicate SK', async () => {
    const s = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await s.putTopicAttempt(topicAttempt('a1'))).toBe(false);
    expect(await s.putExamAttempt(examAttempt('e1'))).toBe(false);
  });

  it('putFlashcard returns false on a stale (older) write', async () => {
    const s = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await s.putFlashcard(flashcard('2026-08-15T10:00:00.000Z'))).toBe(false);
  });

  it('updateLadderLevel returns false on an equal-or-better score', async () => {
    const s = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await s.updateLadderLevel(ladder(), 1, 0.5, 'd1')).toBe(false);
  });

  it('mergeMeta returns false when no field improves (conditional max set)', async () => {
    const s = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await s.mergeMeta(meta())).toBe(false);
  });

  it('setMigrationCompleted returns false on replay', async () => {
    const s = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await s.setMigrationCompleted(USER_ID, PROFILE_ID, 'd1')).toBe(false);
  });

  it('rethrows non-conditional failures (never silently swallowed)', async () => {
    const s = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(s.putTopicAttempt(topicAttempt('a1'))).rejects.toThrow('AccessDeniedException');
    await expect(s.putExamAttempt(examAttempt('e1'))).rejects.toThrow('AccessDeniedException');
    await expect(s.putFlashcard(flashcard('d'))).rejects.toThrow('AccessDeniedException');
    await expect(s.updateLadderLevel(ladder(), 1, 0.5, 'd')).rejects.toThrow('AccessDeniedException');
    await expect(s.mergeMeta(meta())).rejects.toThrow('AccessDeniedException');
    await expect(s.setMigrationCompleted(USER_ID, PROFILE_ID, 'd')).rejects.toThrow('AccessDeniedException');
    await expect(s.listProgressByUser(USER_ID)).rejects.toThrow('AccessDeniedException');
    await expect(s.getMeta(USER_ID, PROFILE_ID)).rejects.toThrow('AccessDeniedException');
  });
});

describe('DynamoProgressStorage — session subset delegation', () => {
  it('delegates getSession/getUserById/updateSession/deleteSession to the injected storage', async () => {
    const sessionSubset = {
      getSession: vi.fn<(sessionId: string) => Promise<SessionRecord | null>>(async () => null),
      getUserById: vi.fn<(userId: string) => Promise<UserRecord | null>>(async () => null),
      updateSession: vi.fn<
        (sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }) => Promise<void>
      >(async () => {}),
      deleteSession: vi.fn<(sessionId: string) => Promise<void>>(async () => {}),
    };
    // The progress DocumentClient must never see session commands.
    const send = vi.fn(async () => {
      throw new Error('progress client must not handle session commands');
    });
    const s = new DynamoProgressStorage({ send } as unknown as DynamoDBDocumentClient, TABLES, sessionSubset);

    await s.getSession('sid');
    await s.getUserById('uid');
    await s.updateSession('sid', { lastAccessedAt: 'now', expiresAt: 123 });
    await s.deleteSession('sid');

    expect(sessionSubset.getSession).toHaveBeenCalledWith('sid');
    expect(sessionSubset.getUserById).toHaveBeenCalledWith('uid');
    expect(sessionSubset.updateSession).toHaveBeenCalledWith('sid', { lastAccessedAt: 'now', expiresAt: 123 });
    expect(sessionSubset.deleteSession).toHaveBeenCalledWith('sid');
    expect(send).not.toHaveBeenCalled();
  });
});
