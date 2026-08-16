import { describe, it, expect, vi } from 'vitest';
import { DynamoAnalyticsStorage } from '@/lib/analytics/dynamodb-storage';
import type { NormalizedAnalyticsEvent } from '@/lib/analytics/types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Adapter tests with a mock DocumentClient: assert the commands the adapter
// sends (table names, keys, expressions, TTL values) — no AWS involved. The
// real client wiring lives in deps.ts and is exercised by the Lambda in
// production.

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

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

const TABLES = { users: 'octav-users', sessions: 'octav-sessions', events: 'octav-analytics-events', rateLimits: 'octav-rate-limits' };

function makeStorage(handler: (cmd: CommandLike) => unknown = () => ({})) {
  return new DynamoAnalyticsStorage(
    mockClient(handler),
    TABLES,
    {
      getSession: async () => null,
      getUserById: async () => null,
      updateSession: async () => {},
      deleteSession: async () => {},
    },
    () => NOW_MS
  );
}

function event(overrides: Partial<NormalizedAnalyticsEvent> = {}): NormalizedAnalyticsEvent {
  return {
    name: 'quiz_started',
    props: { subjectId: 'math', topicId: 'math-yr7-algebra-1', source: 'topic_page' },
    urlPath: '/subjects/math/math-yr7-algebra-1/quiz',
    referrer: 'google.com',
    host: 'octavlearning.com',
    sessionId: 'sess-1',
    ua: 'TestAgent/1.0',
    clientTs: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

function conditionalFailure(): Error {
  const err = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  return err;
}

describe('DynamoAnalyticsStorage.recordEvent — command shapes', () => {
  it('sends one raw Put + four aggregate ADD upserts with TTL values', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });

    await s.recordEvent(event());

    expect(calls).toHaveLength(5);

    // Raw event Put.
    const put = calls[0];
    expect(put.constructor.name).toBe('PutCommand');
    expect(put.input).toMatchObject({
      TableName: 'octav-analytics-events',
      Item: {
        k: 'ev',
        name: 'quiz_started',
        props: { subjectId: 'math', topicId: 'math-yr7-algebra-1', source: 'topic_page' },
        host: 'octavlearning.com',
        sessionId: 'sess-1',
        ua: 'TestAgent/1.0',
      },
    });
    const putItem = put.input.Item as Record<string, unknown>;
    expect(putItem.s).toMatch(/^2026-08-15#\d{13}#[0-9a-f-]{36}$/);
    expect(putItem.expiresAt).toBe(Math.floor(NOW_MS / 1000) + 90 * 86_400);

    // One ADD upsert per aggregate kind, keyed by (date, kind, key).
    const updates = calls.slice(1);
    const updateSk = (cmd: CommandLike) => (cmd.input.Key as { s: string }).s;
    expect(updates.map(updateSk).sort()).toEqual(
      [
        '2026-08-15#event#quiz_started',
        '2026-08-15#host#octavlearning.com',
        '2026-08-15#page#/subjects/math/math-yr7-algebra-1/quiz',
        '2026-08-15#referrer#google.com',
      ].sort()
    );
    for (const cmd of updates) {
      expect(cmd.input).toEqual({
        TableName: 'octav-analytics-events',
        Key: { k: 'agg', s: updateSk(cmd) },
        UpdateExpression: 'ADD #c :one SET expiresAt = :exp',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':exp': Math.floor(NOW_MS / 1000) + 400 * 86_400 },
      });
    }
  });

  it('buckets an empty referrer under "direct" and truncates ua to 80 chars', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });

    await s.recordEvent(event({ referrer: '', ua: 'A'.repeat(120) }));

    const putItem = calls[0].input.Item as Record<string, unknown>;
    expect(putItem.ua).toBe('A'.repeat(80));
    const sk = (cmd: CommandLike) => (cmd.input.Key as { s: string }).s;
    expect(calls.slice(1).map(sk)).toContain('2026-08-15#referrer#direct');
  });
});

describe('DynamoAnalyticsStorage.incrementAnalyticsEventCount', () => {
  it('sends a conditional fixed-window Update on octav-rate-limits', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });

    expect(await s.incrementAnalyticsEventCount('1.2.3.4', 120, 600)).toBe(true);
    expect(calls).toHaveLength(1);
    // NOW_MS = 2026-08-16T12:00Z → epoch 0 is 1970 — irrelevant; the bucket
    // key carries the epoch derived from the injected clock.
    const epoch = Math.floor(NOW_MS / 600_000);
    expect(calls[0].input).toEqual({
      TableName: 'octav-rate-limits',
      Key: { bucket: `analytics:1.2.3.4:${epoch}` },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
      ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
      ExpressionAttributeNames: { '#c': 'count' },
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':limit': 120, ':exp': (epoch + 1) * 600 },
    });
  });

  it('returns false on a conditional failure (budget spent), rethrows other errors', async () => {
    const failing = makeStorage(() => {
      throw conditionalFailure();
    });
    expect(await failing.incrementAnalyticsEventCount('ip', 120, 600)).toBe(false);

    const broken = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(broken.incrementAnalyticsEventCount('ip', 120, 600)).rejects.toThrow('AccessDeniedException');
  });
});

describe('DynamoAnalyticsStorage.getSummary', () => {
  it('queries the aggregate partition BETWEEN the window, looping LastEvaluatedKey', async () => {
    const queries: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      if (cmd.constructor.name === 'QueryCommand') {
        queries.push(cmd);
        if (queries.length === 1) {
          return {
            Items: [{ k: 'agg', s: '2026-08-15#event#page_view', count: 2 }],
            LastEvaluatedKey: { k: 'agg', s: '2026-08-15#event#page_view' },
          };
        }
        return { Items: [{ k: 'agg', s: '2026-08-16#page#/subjects', count: 3 }] };
      }
      return {};
    });

    const summary = await s.getSummary(7);

    expect(queries).toHaveLength(2);
    expect(queries[0].input).toMatchObject({
      TableName: 'octav-analytics-events',
      KeyConditionExpression: 'k = :k AND s BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':k': 'agg', ':from': '2026-08-10#', ':to': '2026-08-16#~' },
    });
    expect(queries[0].input.ExclusiveStartKey).toBeUndefined();
    expect(queries[1].input.ExclusiveStartKey).toEqual({ k: 'agg', s: '2026-08-15#event#page_view' });

    // Every page was folded (no truncation).
    expect(summary.days).toBe(7);
    expect(summary.totals).toEqual({ page_view: 2 });
    expect(summary.topPages).toEqual([{ path: '/subjects', count: 3 }]);
  });

  it('rethrows query failures (never silently truncates)', async () => {
    const s = makeStorage(() => {
      throw new Error('AccessDeniedException');
    });
    await expect(s.getSummary(30)).rejects.toThrow('AccessDeniedException');
  });
});

describe('DynamoAnalyticsStorage.probeAnalyticsTable', () => {
  it('sends a Limit-1 Query on a fixed probe key', async () => {
    const calls: CommandLike[] = [];
    const s = makeStorage((cmd) => {
      calls.push(cmd);
      return {};
    });
    await s.probeAnalyticsTable();
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toEqual({
      TableName: 'octav-analytics-events',
      KeyConditionExpression: 'k = :probe',
      ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
      Limit: 1,
    });
  });
});

describe('DynamoAnalyticsStorage — session subset delegation', () => {
  it('delegates getSession/getUserById/updateSession/deleteSession to the injected storage', async () => {
    const sessionSubset = {
      getSession: vi.fn(async () => null),
      getUserById: vi.fn(async () => null),
      updateSession: vi.fn(async () => {}),
      deleteSession: vi.fn(async () => {}),
    };
    const send = vi.fn(async () => {
      throw new Error('analytics client must not handle session commands');
    });
    const s = new DynamoAnalyticsStorage(
      { send } as unknown as DynamoDBDocumentClient,
      TABLES,
      sessionSubset,
      () => NOW_MS
    );

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
