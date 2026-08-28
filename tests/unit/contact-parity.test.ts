import { describe, it, expect } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { InMemoryContactStorage } from '@/lib/contact/dummy';
import { DynamoContactStorage } from '@/lib/contact/dynamodb-storage';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import type { ContactMessage, ContactStorage } from '@/lib/contact/types';
import { contactMessageTtl, contactRateLimitBucket } from '@/lib/contact/types';

// Rule 2 (the key test): the in-memory dummy must produce the SAME state as
// the DynamoDB adapter for an identical op sequence. The simulated
// DocumentClient below is an INDEPENDENT re-implementation of DynamoDB's
// semantics (it never calls the adapter): PutCommand stores the item,
// UpdateCommand evaluates `if_not_exists(count, 0) + 1` against the
// conditional `attribute_not_exists(count) OR count < :limit` (throwing
// ConditionalCheckFailedException on failure), GetCommand returns nothing for
// the probe key. If the dummy's mirror ever drifts from the adapter's
// commands, the snapshots diverge here. (The leaderboard-parity.test.ts
// pattern.)

const T0 = Date.parse('2026-08-25T12:00:00.000Z');

interface SimBucket {
  count: number;
  expiresAt: number;
}

function simulatedDdb() {
  const messages = new Map<string, ContactMessage>(); // messageId → row
  const buckets = new Map<string, SimBucket>(); // bucket key → counter

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'PutCommand') {
      const item = input.Item as ContactMessage;
      messages.set(item.messageId, { ...item });
      return {};
    }

    if (cmd.constructor.name === 'UpdateCommand') {
      // Fixed-window budget upsert:
      //   SET count = if_not_exists(count, :zero) + :inc, expiresAt = :exp
      //   CONDITION attribute_not_exists(count) OR count < :limit
      const bucket = input.Key.bucket as string;
      const v = input.ExpressionAttributeValues;
      const existing = buckets.get(bucket);
      const conditionPasses = existing === undefined || existing.count < (v[':limit'] as number);
      if (!conditionPasses) {
        const err = new Error('The conditional request failed');
        err.name = 'ConditionalCheckFailedException';
        throw err;
      }
      buckets.set(bucket, {
        count: (existing?.count ?? (v[':zero'] as number)) + (v[':inc'] as number),
        expiresAt: v[':exp'] as number,
      });
      return {};
    }

    if (cmd.constructor.name === 'GetCommand') {
      // The health probe key never exists.
      return {};
    }

    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return {
    client: { send } as unknown as DynamoDBDocumentClient,
    messages,
    buckets,
  };
}

const TABLES = { users: 'u', sessions: 's', contact: 'c', rateLimits: 'rl' };

const SESSION_SUBSET = {
  getSession: async () => null,
  getUserById: async () => null,
  updateSession: async () => {},
  deleteSession: async () => {},
};

function makePair(clock: () => number) {
  const sim = simulatedDdb();
  return {
    dummy: new InMemoryContactStorage(clock),
    ddb: new DynamoContactStorage(sim.client, TABLES, SESSION_SUBSET, clock),
    sim,
  };
}

function message(id: string, overrides: Partial<ContactMessage> = {}): ContactMessage {
  return {
    messageId: id,
    name: 'Ada',
    email: 'ada@example.com',
    subject: 'question',
    message: 'hi',
    userId: null,
    createdAt: '2026-08-25T12:00:00.000Z',
    status: 'new',
    expiresAt: contactMessageTtl(T0),
    ...overrides,
  };
}

function sortedMessages(map: Map<string, ContactMessage>): ContactMessage[] {
  return [...map.values()].sort((a, b) => a.messageId.localeCompare(b.messageId));
}

describe('dummy ↔ DynamoDB contact parity (rule 2)', () => {
  it('stores identical message rows for an identical save sequence', async () => {
    const { dummy, ddb, sim } = makePair(() => T0);
    const messages = [
      message('m1'),
      message('m2', { subject: 'bug_report', userId: 'user-1' }),
      message('m3', { subject: 'feature_request', name: 'Grace' }),
    ];
    for (const m of messages) {
      await dummy.saveContactMessage(m);
      await ddb.saveContactMessage(m);
    }

    const dummyRows = sortedMessages(
      (dummy as unknown as { messages: Map<string, ContactMessage> }).messages
    );
    expect(dummyRows).toEqual(sortedMessages(sim.messages));
    // Sanity on the actual values (not just agreement).
    expect(dummyRows.map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3']);
    expect(dummyRows[0]).toEqual(message('m1'));
  });

  it('produces identical allow/deny sequences for the fixed-window budget', async () => {
    let now = T0;
    const { dummy, ddb, sim } = makePair(() => now);

    const run = (storage: ContactStorage) => storage.incrementContactCount('1.2.3.4', 3, 3600);

    // First window: 3 allowed, then denials (incl. the LAST-XFF-equivalent —
    // the same ip string hits the same bucket).
    const firstWindowDummy = [await run(dummy), await run(dummy), await run(dummy), await run(dummy)];
    const firstWindowDdb = [await run(ddb), await run(ddb), await run(ddb), await run(ddb)];
    expect(firstWindowDummy).toEqual([true, true, true, false]);
    expect(firstWindowDdb).toEqual(firstWindowDummy);

    // A different IP has its own bucket in both implementations.
    expect(await dummy.incrementContactCount('5.6.7.8', 3, 3600)).toBe(true);
    expect(await ddb.incrementContactCount('5.6.7.8', 3, 3600)).toBe(true);

    // Window roll: the counter resets atomically (fresh bucket key).
    now += 3600_000;
    expect(await run(dummy)).toBe(true);
    expect(await run(ddb)).toBe(true);

    // The DynamoDB bucket keys are the shared pure-helper keys.
    const epoch0 = Math.floor(T0 / 3_600_000);
    expect(sim.buckets.has(`contact:1.2.3.4:${epoch0}`)).toBe(true);
    expect(sim.buckets.has(`contact:1.2.3.4:${epoch0 + 1}`)).toBe(true);
    expect(sim.buckets.get(`contact:1.2.3.4:${epoch0}`)).toEqual({
      count: 3, // the 4th (denied) increment did NOT write
      expiresAt: (epoch0 + 1) * 3600, // TTL: end of the epoch window
    });
    expect(contactRateLimitBucket('1.2.3.4', T0)).toBe(`contact:1.2.3.4:${epoch0}`);
  });

  it('probeContactTable resolves on both implementations', async () => {
    const { dummy, ddb } = makePair(() => T0);
    await expect(dummy.probeContactTable()).resolves.toBeUndefined();
    await expect(ddb.probeContactTable()).resolves.toBeUndefined();
  });

  it('the dummy continues the shared in-memory universe chain (auth → … → leaderboard → contact)', async () => {
    const storage = new InMemoryContactStorage();
    expect(storage).toBeInstanceOf(InMemoryLeaderboardStorage);
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
    // A session written by the auth routes resolves for the contact storage's
    // session subset (the handler relies on this for userId attribution).
    expect((await storage.getUserById('u1'))?.email).toBe('a@example.com');
    expect(await storage.getSession('missing')).toBeNull();
  });
});
