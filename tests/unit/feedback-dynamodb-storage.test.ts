import { describe, it, expect } from 'vitest';
import { DynamoFeedbackStorage } from '@/lib/feedback/dynamodb-storage';
import { DynamoSessionStorage } from '@/lib/auth/dynamodb-storage';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AI_MARK_BUCKET_TTL_SECONDS } from '@/lib/feedback/types';

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

const TABLES = { users: 'octav-users', sessions: 'octav-sessions', rateLimits: 'octav-rate-limits' };

const T0 = Date.parse('2026-08-15T10:00:00Z');

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  const client = mockClient(handler);
  return new DynamoFeedbackStorage(client, TABLES, new DynamoSessionStorage(client, TABLES), () => T0);
}

function conditionalFailure(): Error {
  const err = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  return err;
}

describe('DynamoFeedbackStorage — monthly AI-mark quota (E2)', () => {
  it('incrementAiMarkCount sends ONE conditional UpdateCommand on the aimark bucket', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
    });

    const allowed = await storage.incrementAiMarkCount('u1', 30, '2026-08');

    expect(allowed).toBe(true);
    expect(sent).toHaveLength(1);
    const input = sent[0].input as unknown as {
      TableName: string;
      Key: { bucket: string };
      UpdateExpression: string;
      ConditionExpression: string;
      ExpressionAttributeValues: Record<string, unknown>;
    };
    expect(sent[0].constructor.name).toBe('UpdateCommand');
    expect(input.TableName).toBe('octav-rate-limits');
    expect(input.Key).toEqual({ bucket: 'aimark:u1:2026-08' });
    expect(input.UpdateExpression).toBe('SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp');
    expect(input.ConditionExpression).toBe('attribute_not_exists(#c) OR #c < :limit');
    expect(input.ExpressionAttributeValues[':limit']).toBe(30);
    // TTL ~40 days from now (cleanup only — the month key does the reset).
    expect(input.ExpressionAttributeValues[':exp']).toBe(Math.floor(T0 / 1000) + AI_MARK_BUCKET_TTL_SECONDS);
  });

  it('incrementAiMarkCount maps ConditionalCheckFailedException to false (quota exhausted)', async () => {
    const storage = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await storage.incrementAiMarkCount('u1', 30, '2026-08')).toBe(false);
  });

  it('incrementAiMarkCount rethrows non-conditional failures', async () => {
    const storage = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(storage.incrementAiMarkCount('u1', 30, '2026-08')).rejects.toThrow('AccessDeniedException');
  });

  it('getAiMarkCount reads the bucket count (0 when absent)', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
      return { Item: { bucket: 'aimark:u1:2026-08', count: 12 } };
    });

    expect(await storage.getAiMarkCount('u1', '2026-08')).toBe(12);
    expect(sent[0].constructor.name).toBe('GetCommand');
    expect(sent[0].input.TableName).toBe('octav-rate-limits');
    expect(sent[0].input.Key).toEqual({ bucket: 'aimark:u1:2026-08' });

    const empty = makeStorage(() => ({}));
    expect(await empty.getAiMarkCount('u1', '2026-08')).toBe(0);
  });

  it('session validation is delegated to the shared DynamoSessionStorage', async () => {
    const sent: CommandLike[] = [];
    const storage = makeStorage((cmd) => {
      sent.push(cmd);
      return {};
    });

    await storage.getSession('s1');
    await storage.getUserById('u1');
    await storage.updateSession('s1', { lastAccessedAt: 'now', expiresAt: 123 });
    await storage.deleteSession('s1');

    expect(sent.map((c) => c.constructor.name)).toEqual(['GetCommand', 'GetCommand', 'UpdateCommand', 'DeleteCommand']);
    expect(sent[0].input.TableName).toBe('octav-sessions');
    expect(sent[1].input.TableName).toBe('octav-users');
    expect(sent[2].input.TableName).toBe('octav-sessions');
    expect(sent[3].input.TableName).toBe('octav-sessions');
  });
});
