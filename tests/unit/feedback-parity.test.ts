import { describe, it, expect } from 'vitest';
import { InMemoryFeedbackStorage } from '@/lib/feedback/dummy';
import { DynamoFeedbackStorage } from '@/lib/feedback/dynamodb-storage';
import { DynamoSessionStorage } from '@/lib/auth/dynamodb-storage';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { FeedbackStorage } from '@/lib/feedback/types';

// Rule 2 (the key test): the in-memory dummy must produce the SAME allow/deny
// outcomes as the DynamoDB adapter for an identical increment sequence. The
// simulated DocumentClient below is an INDEPENDENT re-implementation of
// DynamoDB's conditional semantics (it never calls the adapter) — buckets are
// keyed by `bucket` and the condition `attribute_not_exists(#c) OR #c < :limit`
// is evaluated directly. If the dummy's mirror ever drifts from the adapter's
// condition, the sequences diverge here.

function simulatedDdb() {
  const buckets = new Map<string, number>();

  const fail = () => {
    const err = new Error('The conditional request failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  };

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'UpdateCommand') {
      // aimark bucket (octav-rate-limits): keyed by bucket —
      // `attribute_not_exists(#c) OR #c < :limit`.
      const bucket = input.Key.bucket as string;
      const limit = input.ExpressionAttributeValues[':limit'] as number;
      const count = buckets.get(bucket) ?? 0;
      if (count >= limit) fail();
      buckets.set(bucket, count + 1);
      return {};
    }

    if (cmd.constructor.name === 'GetCommand') {
      const bucket = input.Key.bucket as string;
      const count = buckets.get(bucket);
      return count === undefined ? {} : { Item: { bucket, count } };
    }

    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return { send } as unknown as DynamoDBDocumentClient;
}

const TABLES = { users: 'u', sessions: 's', rateLimits: 'rl' };

describe('AI-mark quota parity (dummy ↔ simulated DDB)', () => {
  it('produces identical allow/deny sequences across a calendar-month roll', async () => {
    let now = Date.parse('2026-08-31T23:00:00Z');
    const clock = () => now;

    const dummy: FeedbackStorage = new InMemoryFeedbackStorage(clock);
    const sim = simulatedDdb();
    const ddb: FeedbackStorage = new DynamoFeedbackStorage(sim, TABLES, new DynamoSessionStorage(sim, TABLES), clock);

    const step = async (storage: FeedbackStorage, out: boolean[]) => {
      const monthKey = new Date(now).toISOString().slice(0, 7); // handler-derived window key
      out.push(await storage.incrementAiMarkCount('u1', 3, monthKey));
    };

    const dummyResults: boolean[] = [];
    const ddbResults: boolean[] = [];

    // August (limit 3): allow, allow, allow, deny.
    for (let i = 0; i < 4; i++) {
      await step(dummy, dummyResults);
      await step(ddb, ddbResults);
    }
    // Roll into September: fresh bucket → allow, allow.
    now = Date.parse('2026-09-01T00:30:00Z');
    for (let i = 0; i < 2; i++) {
      await step(dummy, dummyResults);
      await step(ddb, ddbResults);
    }

    expect(dummyResults).toEqual(ddbResults);
    expect(dummyResults).toEqual([true, true, true, false, true, true]);

    // Read path parity: the September bucket holds exactly the two charges.
    expect(await dummy.getAiMarkCount('u1', '2026-09')).toBe(await ddb.getAiMarkCount('u1', '2026-09'));
    expect(await dummy.getAiMarkCount('u1', '2026-09')).toBe(2);
    expect(await dummy.getAiMarkCount('u1', '2026-08')).toBe(await ddb.getAiMarkCount('u1', '2026-08'));
    expect(await dummy.getAiMarkCount('u1', '2026-08')).toBe(3);
  });

  it('quota is per userId — one user cannot spend another\u2019s budget', async () => {
    const dummy = new InMemoryFeedbackStorage();
    const sim = simulatedDdb();
    const ddb = new DynamoFeedbackStorage(sim, TABLES, new DynamoSessionStorage(sim, TABLES));

    for (const storage of [dummy, ddb]) {
      expect(await storage.incrementAiMarkCount('u1', 1, '2026-08')).toBe(true);
      expect(await storage.incrementAiMarkCount('u1', 1, '2026-08')).toBe(false); // u1 exhausted
      expect(await storage.incrementAiMarkCount('u2', 1, '2026-08')).toBe(true); // u2 unaffected
    }
  });
});
