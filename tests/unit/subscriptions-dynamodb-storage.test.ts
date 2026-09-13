import { describe, it, expect } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSessionStorage, DynamoUserWriter } from '@/lib/auth/dynamodb-storage';
import { DynamoSubscriptionsStorage, EVENT_LEDGER_TTL_SECONDS } from '@/lib/subscriptions/dynamodb-storage';
import { SUBSCRIPTION_SESSIONS_PER_WINDOW, subscriptionRateLimitBucket } from '@/lib/subscriptions/types';

// Adapter tests with a mock DocumentClient: assert the commands the adapter
// sends (table, key, expressions, conditions) — no AWS involved. The real
// client wiring lives in deps.ts and is exercised by the Lambda in production.

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

const TABLES = { users: 'octav-users', sessions: 'octav-sessions', rateLimits: 'octav-rate-limits' };
const T0 = Date.parse('2026-08-15T10:00:00Z');

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  const client = mockClient(handler);
  return new DynamoSubscriptionsStorage(
    client,
    TABLES,
    new DynamoSessionStorage(client, TABLES),
    new DynamoUserWriter(client, TABLES.users),
    () => T0
  );
}

function conditionalFailure(): Error {
  const err = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  return err;
}

describe('DynamoSubscriptionsStorage — webhook idempotency ledger (E4.2)', () => {
  it('marks an event once with ONE conditional PutItem on octav-rate-limits', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
    });

    await expect(storage.markEventProcessed('evt_1')).resolves.toBe(true);

    expect(sent).toHaveLength(1);
    expect(sent[0].constructor.name).toBe('PutCommand');
    const input = sent[0].input as unknown as {
      TableName: string;
      Item: { bucket: string; expiresAt: number };
      ConditionExpression: string;
    };
    expect(input.TableName).toBe('octav-rate-limits');
    expect(input.Item.bucket).toBe('stripe-event:evt_1');
    expect(input.Item.expiresAt).toBe(Math.floor(T0 / 1000) + EVENT_LEDGER_TTL_SECONDS);
    // The condition IS the idempotency: a replayed delivery fails it.
    expect(input.ConditionExpression).toBe('attribute_not_exists(bucket)');
  });

  it('reports a replay as "already processed" instead of throwing', async () => {
    const storage = makeStorage(() => {
      throw conditionalFailure();
    });
    await expect(storage.markEventProcessed('evt_1')).resolves.toBe(false);
  });

  it('does not swallow a real DynamoDB failure', async () => {
    const storage = makeStorage(() => {
      throw new Error('ProvisionedThroughputExceededException');
    });
    await expect(storage.markEventProcessed('evt_1')).rejects.toThrow(/Throughput/);
  });
});

describe('DynamoSubscriptionsStorage — checkout session budget', () => {
  it('sends one conditional UpdateCommand on the per-user window bucket', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
    });

    await expect(
      storage.incrementSessionBudget('user-1', SUBSCRIPTION_SESSIONS_PER_WINDOW, 3600)
    ).resolves.toBe(true);

    expect(sent[0].constructor.name).toBe('UpdateCommand');
    const input = sent[0].input as unknown as {
      TableName: string;
      Key: { bucket: string };
      ConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
    };
    expect(input.TableName).toBe('octav-rate-limits');
    expect(input.Key.bucket).toBe(subscriptionRateLimitBucket('user-1', T0, 3600));
    expect(input.ConditionExpression).toBe('attribute_not_exists(#c) OR #c < :limit');
    expect(input.ExpressionAttributeValues[':limit']).toBe(SUBSCRIPTION_SESSIONS_PER_WINDOW);
  });

  it('returns false (not an error) once the window budget is spent', async () => {
    const storage = makeStorage(() => {
      throw conditionalFailure();
    });
    await expect(storage.incrementSessionBudget('user-1', 20, 3600)).resolves.toBe(false);
  });
});

describe('DynamoSubscriptionsStorage — user row + session delegation', () => {
  it('writes only the billing fields present, plus the derived tier', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
      if (cmd.constructor.name === 'UpdateCommand') return { Attributes: { userId: 'user-1', tier: 'premium' } };
    });

    const updated = await storage.updateUser('user-1', {
      subscriptionStatus: 'trialing',
      subscriptionPlan: 'monthly',
      tier: 'premium',
    });

    const input = sent[0].input as unknown as {
      TableName: string;
      UpdateExpression: string;
      ConditionExpression: string;
      ReturnValues: string;
      ExpressionAttributeNames: Record<string, string>;
    };
    expect(input.TableName).toBe('octav-users');
    expect(input.ConditionExpression).toBe('attribute_exists(userId)');
    expect(input.ReturnValues).toBe('ALL_NEW');
    // Fields are written through #placeholders (the auth adapter's convention),
    // so the mapping is what proves WHICH fields were set.
    expect(Object.values(input.ExpressionAttributeNames)).toEqual(
      expect.arrayContaining(['subscriptionStatus', 'subscriptionPlan', 'tier'])
    );
    // A field that was not supplied must NOT be in the SET — otherwise a
    // webhook that omits it would blank cached state.
    expect(Object.values(input.ExpressionAttributeNames)).not.toContain('cardLast4');
    expect(updated).toMatchObject({ userId: 'user-1', tier: 'premium' });
  });

  it('returns null when the account is gone, so the webhook acknowledges instead of retrying', async () => {
    const storage = makeStorage(() => {
      throw conditionalFailure();
    });
    await expect(storage.updateUser('user-gone', { tier: 'premium' })).resolves.toBeNull();
  });

  it('delegates session reads/writes to the shared DynamoSessionStorage', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
      if (cmd.constructor.name === 'GetCommand') return { Item: { sessionId: 's1', userId: 'user-1' } };
    });

    await expect(storage.getSession('s1')).resolves.toMatchObject({ sessionId: 's1' });
    expect(sent[0].input.TableName).toBe('octav-sessions');

    await storage.updateSession('s1', { lastAccessedAt: '2026-08-15T10:00:00Z', expiresAt: 123 });
    expect(sent[1].input.TableName).toBe('octav-sessions');

    await storage.deleteSession('s1');
    expect(sent[2].input.TableName).toBe('octav-sessions');
  });

  it('probes the users table with a key that never exists (CI smoke)', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
    });

    await storage.probeTable();

    expect(sent[0].constructor.name).toBe('GetCommand');
    const input = sent[0].input as unknown as { TableName: string; Key: { userId: string } };
    expect(input.TableName).toBe('octav-users');
    expect(input.Key.userId).toBe('__health_probe_nonexistent__');
  });
});
