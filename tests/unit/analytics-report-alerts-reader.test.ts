import { describe, it, expect } from 'vitest';
import { DynamoOpenAlertsReader } from '@/lib/analytics-report/dynamodb-alerts-reader';
import type { Alert } from '@/lib/support-bot/types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// S6 open-alerts reader (docs/support-bot-plan.md §9 Q9): the GSI1
// (status → createdAt) query shape — one newest-first Query per unresolved
// status, LastEvaluatedKey looped. The fake client records every command and
// serves canned pages per status (pages consumed in call order).

function makeAlert(status: Alert['status'], overrides: Partial<Alert> = {}): Alert {
  return {
    alertId: `a-${status}`,
    source: 'analytics',
    sourceRef: 'agg:2026-08-16',
    severity: 'high',
    title: 'Something happened',
    body: 'body',
    status,
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z',
    resolvedAt: null,
    dedupKey: `a-${status}`,
    expiresAt: 0,
    ...overrides,
  };
}

type Page = { Items?: Alert[]; LastEvaluatedKey?: Record<string, unknown> };

function fakeClient(pages: Partial<Record<string, Page[]>>) {
  const calls: Array<Record<string, unknown>> = [];
  const queues = new Map(Object.entries(pages).map(([k, v]) => [k, [...(v ?? [])]]));
  const send = async (cmd: { input: Record<string, unknown> }) => {
    calls.push(cmd.input);
    const status = (cmd.input.ExpressionAttributeValues as Record<string, unknown>)[':status'] as string;
    const queue = queues.get(status) ?? [];
    return queue.shift() ?? { Items: [] };
  };
  return { calls, send };
}

describe('DynamoOpenAlertsReader', () => {
  it('queries GSI1 newest-first for BOTH unresolved statuses and returns the mapped rows', async () => {
    const { calls, send } = fakeClient({
      open: [{ Items: [makeAlert('open', { alertId: 'o1' })] }],
      acknowledged: [{ Items: [makeAlert('acknowledged', { alertId: 'k1' })] }],
    });
    const reader = new DynamoOpenAlertsReader(
      { send } as unknown as DynamoDBDocumentClient,
      'octav-support-alerts'
    );

    const rows = await reader.listUnresolvedAlerts();

    expect(calls).toHaveLength(2);
    for (const input of calls) {
      expect(input.TableName).toBe('octav-support-alerts');
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe('#st = :status');
      expect(input.ScanIndexForward).toBe(false);
    }
    const queried = calls.map(
      (c) => (c.ExpressionAttributeValues as Record<string, unknown>)[':status']
    );
    expect(queried).toEqual(['open', 'acknowledged']);

    expect(rows).toEqual([
      {
        severity: 'high',
        title: 'Something happened',
        status: 'open',
        createdAt: '2026-08-16T10:00:00.000Z',
      },
      {
        severity: 'high',
        title: 'Something happened',
        status: 'acknowledged',
        createdAt: '2026-08-16T10:00:00.000Z',
      },
    ]);
  });

  it('loops LastEvaluatedKey within a status until the pages run out', async () => {
    const { calls, send } = fakeClient({
      open: [
        { Items: [makeAlert('open', { alertId: 'p1' })], LastEvaluatedKey: { alertId: 'p1' } },
        { Items: [makeAlert('open', { alertId: 'p2' })] },
      ],
    });
    const reader = new DynamoOpenAlertsReader(
      { send } as unknown as DynamoDBDocumentClient,
      'octav-support-alerts'
    );

    const rows = await reader.listUnresolvedAlerts();

    expect(rows).toHaveLength(2);
    const openCalls = calls.filter(
      (c) => (c.ExpressionAttributeValues as Record<string, unknown>)[':status'] === 'open'
    );
    expect(openCalls).toHaveLength(2);
    expect(openCalls[0].ExclusiveStartKey).toBeUndefined();
    expect(openCalls[1].ExclusiveStartKey).toEqual({ alertId: 'p1' });
  });

  it('returns an empty list when both statuses have no rows', async () => {
    const { send } = fakeClient({});
    const reader = new DynamoOpenAlertsReader(
      { send } as unknown as DynamoDBDocumentClient,
      'octav-support-alerts'
    );
    expect(await reader.listUnresolvedAlerts()).toEqual([]);
  });
});
