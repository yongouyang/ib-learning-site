import { describe, it, expect, vi } from 'vitest';
import { DynamoLeaderboardStorage } from '@/lib/leaderboard/dynamodb-storage';
import {
  LEADERBOARD_USER_INDEX,
  weekTtlEpochSeconds,
  type LeaderboardEntryItem,
} from '@/lib/leaderboard/types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Adapter tests with a mock DocumentClient: assert the commands the adapter
// sends (table name, keys, expressions, pagination) — no AWS involved. The
// real client wiring lands with the deps seam in D3 and is exercised by the
// Lambda in production.

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

const TABLES = { users: 'octav-users', sessions: 'octav-sessions', leaderboard: 'octav-leaderboard' };

const SESSION_SUBSET = {
  getSession: async () => null,
  getUserById: async () => null,
  updateSession: async () => {},
  deleteSession: async () => {},
};

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  return new DynamoLeaderboardStorage(mockClient(handler), TABLES, SESSION_SUBSET);
}

const WEEK = '2026-W35';

function entry(profileId: string, overrides: Partial<LeaderboardEntryItem> = {}): LeaderboardEntryItem {
  return {
    scopeWeek: `stage:ks3#${WEEK}#open`,
    entry: profileId,
    userId: 'u1',
    handle: 'Brave Badger',
    xp: 40,
    lastEarnedAt: '2026-08-19T10:00:00.000Z',
    cohortId: 'open',
    expiresAt: weekTtlEpochSeconds(WEEK),
    ...overrides,
  };
}

describe('DynamoLeaderboardStorage.addXp — command shape', () => {
  it('sends one atomic ADD + set-if-absent Update on the (scope, week, profile) row', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });

    await s.addXp({
      userId: 'u1',
      profileId: 'p1',
      handle: 'Brave Badger',
      scope: 'stage:ks3',
      weekKey: WEEK,
      xp: 40,
      earnedAt: '2026-08-19T10:00:00.000Z',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].constructor.name).toBe('UpdateCommand');
    expect(calls[0].input).toEqual({
      TableName: 'octav-leaderboard',
      Key: { scopeWeek: 'stage:ks3#2026-W35#open', entry: 'p1' },
      UpdateExpression:
        'ADD xp :delta SET #h = if_not_exists(#h, :h), #u = if_not_exists(#u, :u), #c = if_not_exists(#c, :c), #e = if_not_exists(#e, :e), lastEarnedAt = :now',
      ExpressionAttributeNames: { '#h': 'handle', '#u': 'userId', '#c': 'cohortId', '#e': 'expiresAt' },
      ExpressionAttributeValues: {
        ':delta': 40,
        ':h': 'Brave Badger',
        ':u': 'u1',
        ':c': 'open',
        ':e': weekTtlEpochSeconds(WEEK),
        ':now': '2026-08-19T10:00:00.000Z',
      },
    });
  });

  it('derives the scopeWeek key from the scope + week (open cohort always)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.addXp({
      userId: 'u1',
      profileId: 'p1',
      handle: 'H',
      scope: 'stage:dp',
      weekKey: '2026-W34',
      xp: 5,
      earnedAt: 't',
    });
    expect(calls[0].input.Key).toEqual({ scopeWeek: 'stage:dp#2026-W34#open', entry: 'p1' });
    const values = calls[0].input.ExpressionAttributeValues as Record<string, unknown>;
    expect(values[':e']).toBe(weekTtlEpochSeconds('2026-W34'));
  });

  it('ignores non-positive deltas — no command is sent', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.addXp({ userId: 'u1', profileId: 'p1', handle: 'H', scope: 'stage:ks3', weekKey: WEEK, xp: 0, earnedAt: 't' });
    await s.addXp({ userId: 'u1', profileId: 'p1', handle: 'H', scope: 'stage:ks3', weekKey: WEEK, xp: -10, earnedAt: 't' });
    expect(calls).toHaveLength(0);
  });

  it('rethrows client failures (never silently swallowed)', async () => {
    const s = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(
      s.addXp({ userId: 'u1', profileId: 'p1', handle: 'H', scope: 'stage:ks3', weekKey: WEEK, xp: 1, earnedAt: 't' })
    ).rejects.toThrow('AccessDeniedException');
  });
});

describe('DynamoLeaderboardStorage.listBoard', () => {
  it('queries the scopeWeek partition and loops LastEvaluatedKey pages', async () => {
    const queries: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      queries.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        if (queries.length === 1) {
          return {
            Items: [entry('p1'), entry('p2')],
            LastEvaluatedKey: { scopeWeek: `stage:ks3#${WEEK}#open`, entry: 'p2' },
          };
        }
        return { Items: [entry('p3')] };
      }
      return {};
    });

    const items = await s.listBoard('stage:ks3', WEEK);

    expect(items.map((i) => i.entry)).toEqual(['p1', 'p2', 'p3']);
    expect(queries).toHaveLength(2);
    expect(queries[0].input).toEqual({
      TableName: 'octav-leaderboard',
      KeyConditionExpression: 'scopeWeek = :sw',
      ExpressionAttributeValues: { ':sw': `stage:ks3#${WEEK}#open` },
    });
    expect(queries[1].input.ExclusiveStartKey).toEqual({ scopeWeek: `stage:ks3#${WEEK}#open`, entry: 'p2' });
  });

  it('returns [] for an empty board', async () => {
    const s = makeStorage(() => ({ Items: [] }));
    expect(await s.listBoard('global', '2026-W01')).toEqual([]);
  });

  it('tolerates a Query response with no Items key', async () => {
    // DynamoDB omits Items entirely on an empty page.
    const s = makeStorage();
    expect(await s.listBoard('stage:ks3', WEEK)).toEqual([]);
  });

  it('rethrows query failures (never silently truncates)', async () => {
    const s = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(s.listBoard('stage:ks3', WEEK)).rejects.toThrow('AccessDeniedException');
  });
});

describe('DynamoLeaderboardStorage.deleteEntriesByUser', () => {
  it('queries the user-index GSI (paginated) and deletes every matching row', async () => {
    const calls: CommandLike[] = [];
    let queryCount = 0;
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        queryCount += 1;
        if (queryCount === 1) {
          return {
            Items: [entry('p1'), entry('p1', { scopeWeek: 'stage:ks3#2026-W34#open' })],
            LastEvaluatedKey: { scopeWeek: 'stage:ks3#2026-W34#open', entry: 'p1' },
          };
        }
        return { Items: [entry('p1', { scopeWeek: 'stage:dp#2026-W35#open' })] };
      }
      return {};
    });

    await s.deleteEntriesByUser('u1');

    const queries = calls.filter((c) => c.constructor.name === 'QueryCommand');
    expect(queries).toHaveLength(2);
    expect(queries[0].input).toEqual({
      TableName: 'octav-leaderboard',
      IndexName: LEADERBOARD_USER_INDEX,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': 'u1' },
    });
    expect(queries[1].input.ExclusiveStartKey).toEqual({ scopeWeek: 'stage:ks3#2026-W34#open', entry: 'p1' });

    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes.map((d) => d.input.Key)).toEqual([
      { scopeWeek: 'stage:ks3#2026-W35#open', entry: 'p1' },
      { scopeWeek: 'stage:ks3#2026-W34#open', entry: 'p1' },
      { scopeWeek: 'stage:dp#2026-W35#open', entry: 'p1' },
    ]);
    for (const d of deletes) expect(d.input.TableName).toBe('octav-leaderboard');
  });

  it('narrows the delete to one profile when profileId is given (opt-out)', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      if (cmd.constructor.name === 'QueryCommand') {
        return { Items: [entry('p1'), entry('p2')] };
      }
      return {};
    });

    await s.deleteEntriesByUser('u1', 'p2');

    const deletes = calls.filter((c) => c.constructor.name === 'DeleteCommand');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].input.Key).toEqual({ scopeWeek: `stage:ks3#${WEEK}#open`, entry: 'p2' });
  });

  it('sends no DeleteCommand when the user has no rows', async () => {
    const calls: CommandLike[] = [];
    // The GSI page comes back without an Items key (DynamoDB omits it when empty).
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.deleteEntriesByUser('ghost');
    expect(calls.filter((c) => c.constructor.name === 'QueryCommand')).toHaveLength(1);
    expect(calls.filter((c) => c.constructor.name === 'DeleteCommand')).toHaveLength(0);
  });
});

describe('DynamoLeaderboardStorage.probeLeaderboardTable', () => {
  it('sends a Limit-1 Query on a fixed probe key', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.probeLeaderboardTable();
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toEqual({
      TableName: 'octav-leaderboard',
      KeyConditionExpression: 'scopeWeek = :probe',
      ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
      Limit: 1,
    });
  });
});

describe('DynamoLeaderboardStorage — session subset delegation', () => {
  it('delegates getSession/getUserById/updateSession/deleteSession to the injected storage', async () => {
    const sessionSubset = {
      getSession: vi.fn(async () => null),
      getUserById: vi.fn(async () => null),
      updateSession: vi.fn(async () => {}),
      deleteSession: vi.fn(async () => {}),
    };
    // The leaderboard DocumentClient must never see session commands.
    const send = vi.fn(async () => {
      throw new Error('leaderboard client must not handle session commands');
    });
    const s = new DynamoLeaderboardStorage({ send } as unknown as DynamoDBDocumentClient, TABLES, sessionSubset);

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
