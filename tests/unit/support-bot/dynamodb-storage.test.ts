import { describe, it, expect } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ContactMessage } from '@/lib/contact/types';
import { DynamoSupportBotStorage } from '@/lib/support-bot/dynamodb-storage';
import type { Alert } from '@/lib/support-bot/types';

// DynamoDB storage adapter against a SIMULATED DocumentClient — an
// INDEPENDENT re-implementation of DynamoDB's semantics (it never calls the
// adapter): GetCommand reads the alerts map, PutCommand evaluates the
// conditional `attribute_not_exists(alertId) OR status = "resolved"`,
// ScanCommand applies the status filter, QueryCommand applies the BETWEEN
// window (the contact-parity.test.ts pattern).

const TABLES = { alerts: 'octav-support-alerts', contact: 'octav-contact', analytics: 'octav-analytics-events' };

const T0 = Date.parse('2026-09-26T12:00:00.000Z');

function alert(id: string, overrides: Partial<Alert> = {}): Alert {
  return {
    alertId: id,
    source: 'contact',
    sourceRef: id,
    severity: 'high',
    title: 't',
    body: 'b',
    status: 'open',
    createdAt: new Date(T0).toISOString(),
    updatedAt: new Date(T0).toISOString(),
    resolvedAt: null,
    dedupKey: id,
    expiresAt: Math.floor(T0 / 1000) + 90 * 86_400,
    ...overrides,
  };
}

function message(id: string, status: ContactMessage['status'] = 'new'): ContactMessage {
  return {
    messageId: id,
    name: 'Ada',
    email: 'ada@example.com',
    subject: 'question',
    message: 'hi',
    userId: null,
    createdAt: '2026-09-25T10:00:00.000Z',
    status,
    expiresAt: 0,
  };
}

function simulatedDdb() {
  const alerts = new Map<string, Alert>();
  const contactRows: ContactMessage[] = [];
  const aggRows: Array<{ s: string; count: number }> = [];

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'GetCommand') {
      const item = alerts.get(input.Key.alertId);
      return item ? { Item: { ...item } } : {};
    }

    if (cmd.constructor.name === 'PutCommand') {
      const item = input.Item as Alert;
      const existing = alerts.get(item.alertId);
      // ConditionExpression: attribute_not_exists(alertId) OR #status = :resolved
      const conditionPasses = !existing || existing.status === input.ExpressionAttributeValues[':resolved'];
      if (!conditionPasses) {
        const err = new Error('The conditional request failed');
        err.name = 'ConditionalCheckFailedException';
        throw err;
      }
      alerts.set(item.alertId, { ...item });
      return {};
    }

    if (cmd.constructor.name === 'ScanCommand') {
      const want = input.ExpressionAttributeValues[':new'];
      return { Items: contactRows.filter((m) => m.status === want).map((m) => ({ ...m })) };
    }

    if (cmd.constructor.name === 'QueryCommand') {
      const from = input.ExpressionAttributeValues[':from'] as string;
      const to = input.ExpressionAttributeValues[':to'] as string;
      const k = input.ExpressionAttributeValues[':k'] as string;
      return {
        Items: aggRows
          .filter((r) => k === 'agg' && r.s >= from && r.s <= to)
          .map((r) => ({ k: 'agg', s: r.s, count: r.count })),
      };
    }

    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return {
    client: { send } as unknown as DynamoDBDocumentClient,
    alerts,
    contactRows,
    aggRows,
  };
}

describe('DynamoSupportBotStorage', () => {
  it('getAlert returns null for a miss and the stored row for a hit', async () => {
    const sim = simulatedDdb();
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    expect(await storage.getAlert('missing')).toBeNull();
    sim.alerts.set('a1', alert('a1'));
    expect(await storage.getAlert('a1')).toEqual(alert('a1'));
  });

  it('putAlert lands a fresh alert and refuses an unresolved duplicate (conditional)', async () => {
    const sim = simulatedDdb();
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    expect(await storage.putAlert(alert('a1'))).toBe(true);
    expect(await storage.putAlert(alert('a1'))).toBe(false); // still open
    expect(sim.alerts.get('a1')?.title).toBe('t');
  });

  it('putAlert re-opens a RESOLVED alert (§11)', async () => {
    const sim = simulatedDdb();
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    sim.alerts.set('a1', alert('a1', { status: 'resolved', resolvedAt: '2026-09-25T11:00:00.000Z' }));
    expect(await storage.putAlert(alert('a1'))).toBe(true);
    expect(sim.alerts.get('a1')?.status).toBe('open');
  });

  it('putAlert refuses over an acknowledged alert (only resolved re-opens)', async () => {
    const sim = simulatedDdb();
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    sim.alerts.set('a1', alert('a1', { status: 'acknowledged' }));
    expect(await storage.putAlert(alert('a1'))).toBe(false); // acknowledged is not resolved
  });

  it('listNewContactMessages returns only status="new" rows (filtered Scan)', async () => {
    const sim = simulatedDdb();
    sim.contactRows.push(message('m1', 'new'), message('m2', 'read'), message('m3', 'new'), message('m4', 'replied'));
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    const rows = await storage.listNewContactMessages();
    expect(rows.map((m) => m.messageId).sort()).toEqual(['m1', 'm3']);
  });

  it('getAggregatesBetween brackets the window with the #-prefix / ~-suffix trick', async () => {
    const sim = simulatedDdb();
    sim.aggRows.push(
      { s: '2026-09-17#host#octavlearning.com', count: 1 }, // before the window
      { s: '2026-09-18#host#octavlearning.com', count: 2 },
      { s: '2026-09-25#event#page_view', count: 3 },
      { s: '2026-09-26#event#page_view', count: 4 },
      { s: '2026-09-27#event#page_view', count: 5 } // after the window
    );
    const storage = new DynamoSupportBotStorage(sim.client, TABLES);
    const rows = await storage.getAggregatesBetween('2026-09-18', '2026-09-26');
    expect(rows).toEqual([
      { s: '2026-09-18#host#octavlearning.com', count: 2 },
      { s: '2026-09-25#event#page_view', count: 3 },
      { s: '2026-09-26#event#page_view', count: 4 },
    ]);
  });

  it('probeSupportAlertsTable resolves (GetItem on the fixed probe key)', async () => {
    const storage = new DynamoSupportBotStorage(simulatedDdb().client, TABLES);
    await expect(storage.probeSupportAlertsTable()).resolves.toBeUndefined();
  });
});
