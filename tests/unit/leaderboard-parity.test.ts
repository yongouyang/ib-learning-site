import { describe, it, expect } from 'vitest';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import { DynamoLeaderboardStorage } from '@/lib/leaderboard/dynamodb-storage';
import { InMemoryFeedbackStorage } from '@/lib/feedback/dummy';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  scopeWeekPartitionKey,
  weekTtlEpochSeconds,
  type LeaderboardScope,
  type LeaderboardStorage,
} from '@/lib/leaderboard/types';

// Rule 2 (the key test): the in-memory dummy must produce the SAME board
// state as the DynamoDB adapter for an identical op sequence. The simulated
// DocumentClient below is an INDEPENDENT re-implementation of DynamoDB's
// semantics (it never calls the adapter): UpdateCommand evaluates
// `ADD xp :delta` + `if_not_exists` against in-memory items, QueryCommand
// paginates with LastEvaluatedKey (PAGE = 2, so every multi-item read loops),
// DeleteCommand removes by key. If the dummy's mirror ever drifts from the
// adapter's commands, the board snapshots diverge here.

const WEEK = '2026-W35';
const PREV = '2026-W34';
const KS3: LeaderboardScope = 'stage:ks3';
const DP: LeaderboardScope = 'stage:dp';

const PAGE = 2;

interface SimItem {
  scopeWeek: string;
  entry: string;
  userId?: string;
  handle?: string;
  xp?: number;
  lastEarnedAt?: string;
  cohortId?: string;
  expiresAt?: number;
}

function simulatedDdb() {
  const items = new Map<string, SimItem>(); // `${scopeWeek}${entry}` → row
  const keyOf = (scopeWeek: string, entry: string) => `${scopeWeek} ${entry}`;

  const paginate = (all: SimItem[], input: Record<string, any>, sortKeyOf: (i: SimItem) => string) => {
    const sorted = [...all].sort((a, b) => sortKeyOf(a).localeCompare(sortKeyOf(b)));
    let startIdx = 0;
    const startKey = input.ExclusiveStartKey as { scopeWeek: string; entry: string } | undefined;
    if (startKey) {
      startIdx = sorted.findIndex((i) => i.scopeWeek === startKey.scopeWeek && i.entry === startKey.entry);
      if (startIdx === -1) return { Items: [] };
      startIdx += 1;
    }
    const pageSize = (input.Limit as number | undefined) ?? PAGE;
    const page = sorted.slice(startIdx, startIdx + pageSize);
    if (startIdx + pageSize < sorted.length) {
      const last = page[page.length - 1];
      return { Items: page, LastEvaluatedKey: { scopeWeek: last.scopeWeek, entry: last.entry } };
    }
    return { Items: page };
  };

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'UpdateCommand') {
      // Leaderboard ADD/if_not_exists upsert:
      //   ADD xp :delta
      //   SET handle/userId/cohortId/expiresAt = if_not_exists(...),
      //       lastEarnedAt = :now  (always overwritten)
      const key = keyOf(input.Key.scopeWeek, input.Key.entry);
      const existing = items.get(key);
      const v = input.ExpressionAttributeValues;
      items.set(key, {
        scopeWeek: input.Key.scopeWeek,
        entry: input.Key.entry,
        xp: (existing?.xp ?? 0) + (v[':delta'] as number),
        handle: existing?.handle ?? (v[':h'] as string),
        userId: existing?.userId ?? (v[':u'] as string),
        cohortId: existing?.cohortId ?? (v[':c'] as string),
        expiresAt: existing?.expiresAt ?? (v[':e'] as number),
        lastEarnedAt: v[':now'] as string,
      });
      return {};
    }

    if (cmd.constructor.name === 'QueryCommand') {
      if (input.IndexName) {
        // user-index GSI erasure query.
        const userId = input.ExpressionAttributeValues[':userId'] as string;
        const all = [...items.values()].filter((i) => i.userId === userId);
        return paginate(all, input, (i) => `${i.scopeWeek} ${i.entry}`);
      }
      // Table query: board partition (:sw) or the fixed probe key (:probe).
      const sw = (input.ExpressionAttributeValues[':sw'] ?? input.ExpressionAttributeValues[':probe']) as string;
      const all = [...items.values()].filter((i) => i.scopeWeek === sw);
      return paginate(all, input, (i) => i.entry);
    }

    if (cmd.constructor.name === 'DeleteCommand') {
      items.delete(keyOf(input.Key.scopeWeek, input.Key.entry));
      return {};
    }

    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return { send } as unknown as DynamoDBDocumentClient;
}

const TABLES = { users: 'u', sessions: 's', leaderboard: 'lb' };

const SESSION_SUBSET = {
  getSession: async () => null,
  getUserById: async () => null,
  updateSession: async () => {},
  deleteSession: async () => {},
};

function makePair(): { dummy: LeaderboardStorage; ddb: LeaderboardStorage } {
  return {
    dummy: new InMemoryLeaderboardStorage(),
    ddb: new DynamoLeaderboardStorage(simulatedDdb(), TABLES, SESSION_SUBSET),
  };
}

// One op sequence, driven against either storage. Covers: xp accumulation
// across repeated addXp, handle stability on the second add (first handle
// wins), scope/week isolation, non-positive-delta no-ops, and a multi-page
// board (4 entries at PAGE = 2 forces the LastEvaluatedKey loop).
async function runOps(storage: LeaderboardStorage): Promise<void> {
  await storage.addXp({ userId: 'u1', profileId: 'p1', handle: 'Brave Badger', scope: KS3, weekKey: WEEK, xp: 40, earnedAt: '2026-08-19T10:00:00.000Z' });
  // Second add for the same row: xp accumulates, the FIRST handle wins,
  // lastEarnedAt moves to the latest award.
  await storage.addXp({ userId: 'u1', profileId: 'p1', handle: 'Sneaky Fox', scope: KS3, weekKey: WEEK, xp: 30, earnedAt: '2026-08-19T11:00:00.000Z' });
  await storage.addXp({ userId: 'u2', profileId: 'p2', handle: 'Calm Otter', scope: KS3, weekKey: WEEK, xp: 55, earnedAt: '2026-08-19T09:00:00.000Z' });
  await storage.addXp({ userId: 'u3', profileId: 'p3', handle: 'Keen Raven', scope: KS3, weekKey: WEEK, xp: 10, earnedAt: '2026-08-19T12:00:00.000Z' });
  await storage.addXp({ userId: 'u4', profileId: 'p4', handle: 'Jolly Mole', scope: KS3, weekKey: WEEK, xp: 25, earnedAt: '2026-08-19T13:00:00.000Z' });
  // The same profile on a different scope and in the previous week is
  // isolated (separate partitions).
  await storage.addXp({ userId: 'u1', profileId: 'p1', handle: 'Brave Badger', scope: DP, weekKey: WEEK, xp: 15, earnedAt: '2026-08-19T14:00:00.000Z' });
  await storage.addXp({ userId: 'u1', profileId: 'p1', handle: 'Brave Badger', scope: KS3, weekKey: PREV, xp: 99, earnedAt: '2026-08-12T10:00:00.000Z' });
  // Non-positive deltas never create a row (callers skip zero awards — D4).
  await storage.addXp({ userId: 'u5', profileId: 'p5', handle: 'Zero Zebra', scope: KS3, weekKey: WEEK, xp: 0, earnedAt: '2026-08-19T15:00:00.000Z' });
  await storage.addXp({ userId: 'u5', profileId: 'p5', handle: 'Zero Zebra', scope: KS3, weekKey: WEEK, xp: -5, earnedAt: '2026-08-19T15:00:00.000Z' });
  // u2 rows across three partitions (erasure across weeks/scopes; 3 rows at
  // PAGE = 2 forces the GSI pagination loop).
  await storage.addXp({ userId: 'u2', profileId: 'p2', handle: 'Calm Otter', scope: KS3, weekKey: PREV, xp: 5, earnedAt: '2026-08-12T09:00:00.000Z' });
  await storage.addXp({ userId: 'u2', profileId: 'p2', handle: 'Calm Otter', scope: DP, weekKey: WEEK, xp: 7, earnedAt: '2026-08-19T16:00:00.000Z' });
}

async function snapshot(storage: LeaderboardStorage) {
  return {
    ks3Week: await storage.listBoard(KS3, WEEK),
    ks3Prev: await storage.listBoard(KS3, PREV),
    dpWeek: await storage.listBoard(DP, WEEK),
  };
}

describe('dummy ↔ DynamoDB leaderboard parity (rule 2)', () => {
  it('produces identical boards for an identical addXp sequence', async () => {
    const { dummy, ddb } = makePair();
    await runOps(dummy);
    await runOps(ddb);

    const dummySnap = await snapshot(dummy);
    const ddbSnap = await snapshot(ddb);
    expect(dummySnap).toEqual(ddbSnap);

    // Sanity on the actual values (not just agreement).
    expect(dummySnap.ks3Week.map((i) => i.entry)).toEqual(['p1', 'p2', 'p3', 'p4']);
    const p1 = dummySnap.ks3Week[0];
    expect(p1).toEqual({
      scopeWeek: scopeWeekPartitionKey(KS3, WEEK),
      entry: 'p1',
      userId: 'u1',
      handle: 'Brave Badger', // first handle wins (if_not_exists)
      xp: 70, // 40 + 30 accumulated
      lastEarnedAt: '2026-08-19T11:00:00.000Z', // always overwritten
      cohortId: 'open',
      expiresAt: weekTtlEpochSeconds(WEEK),
    });
    // Scope/week isolation: p1's other rows live in their own partitions.
    expect(dummySnap.ks3Prev.map((i) => [i.entry, i.xp])).toEqual([
      ['p1', 99],
      ['p2', 5],
    ]);
    expect(dummySnap.dpWeek.map((i) => [i.entry, i.xp])).toEqual([
      ['p1', 15],
      ['p2', 7],
    ]);
    // The zero/negative awards created no row for p5.
    expect(dummySnap.ks3Week.some((i) => i.entry === 'p5')).toBe(false);
  });

  it('deleteEntriesByUser with a profileId narrows erasure to that profile', async () => {
    const { dummy, ddb } = makePair();
    for (const storage of [dummy, ddb]) {
      await runOps(storage);
      // A second child profile on the SAME user: the narrowed delete must
      // skip it (opt-out removes one child, not the sibling).
      await storage.addXp({ userId: 'u1', profileId: 'p1b', handle: 'Mighty Wren', scope: KS3, weekKey: WEEK, xp: 3, earnedAt: '2026-08-19T17:00:00.000Z' });
      await storage.deleteEntriesByUser('u1', 'p1');
    }

    const dummySnap = await snapshot(dummy);
    const ddbSnap = await snapshot(ddb);
    expect(dummySnap).toEqual(ddbSnap);

    // All three of p1's rows (both scopes, both weeks) are gone; the sibling
    // profile p1b and u2's rows survive in every partition.
    expect(dummySnap.ks3Week.map((i) => i.entry)).toEqual(['p1b', 'p2', 'p3', 'p4']);
    expect(dummySnap.ks3Prev.map((i) => i.entry)).toEqual(['p2']);
    expect(dummySnap.dpWeek.map((i) => i.entry)).toEqual(['p2']);
  });

  it('deleteEntriesByUser without a profileId erases every row the user owns', async () => {
    const { dummy, ddb } = makePair();
    for (const storage of [dummy, ddb]) {
      await runOps(storage);
      await storage.deleteEntriesByUser('u2');
    }

    const dummySnap = await snapshot(dummy);
    const ddbSnap = await snapshot(ddb);
    expect(dummySnap).toEqual(ddbSnap);

    // u2's three rows across both scopes and both weeks are gone; the other
    // users are untouched.
    expect(dummySnap.ks3Week.map((i) => i.entry)).toEqual(['p1', 'p3', 'p4']);
    expect(dummySnap.ks3Prev.map((i) => i.entry)).toEqual(['p1']);
    expect(dummySnap.dpWeek.map((i) => i.entry)).toEqual(['p1']);
  });

  it('a delete for an unknown user is a no-op on both implementations', async () => {
    const { dummy, ddb } = makePair();
    for (const storage of [dummy, ddb]) {
      await runOps(storage);
      await storage.deleteEntriesByUser('nobody');
    }
    expect(await snapshot(dummy)).toEqual(await snapshot(ddb));
    expect((await dummy.listBoard(KS3, WEEK)).map((i) => i.entry)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('probeLeaderboardTable resolves on both implementations', async () => {
    const { dummy, ddb } = makePair();
    await expect(dummy.probeLeaderboardTable()).resolves.toBeUndefined();
    await expect(ddb.probeLeaderboardTable()).resolves.toBeUndefined();
  });

  it('the dummy continues the shared in-memory universe chain (auth → … → leaderboard)', async () => {
    const storage = new InMemoryLeaderboardStorage();
    expect(storage).toBeInstanceOf(InMemoryFeedbackStorage);
    await storage.createUser({
      userId: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      role: 'parent',
      tier: 'free',
      childProfiles: [],
      createdAt: 'now',
      lastLoginAt: 'now',
    });
    // A session written by the auth routes resolves for the leaderboard
    // storage's session subset (D3 will rely on this).
    expect((await storage.getUserById('u1'))?.email).toBe('a@example.com');
    expect(await storage.getSession('missing')).toBeNull();
  });
});
