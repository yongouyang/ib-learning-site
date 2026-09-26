import { describe, it, expect } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { InMemoryContactStorage } from '@/lib/contact/dummy';
import type { ContactMessage } from '@/lib/contact/types';
import { InMemorySupportBotStorage } from '@/lib/support-bot/dummy';
import { DynamoSupportBotStorage } from '@/lib/support-bot/dynamodb-storage';
import type { Alert, SupportBotStorage } from '@/lib/support-bot/types';

// Dummy ↔ DynamoDB parity (rule 2): the in-memory dummy must produce the SAME
// state as the DynamoDB adapter for an identical op sequence. The simulated
// DocumentClient below is an INDEPENDENT re-implementation of DynamoDB's
// semantics (it never calls the adapter) — the contact-parity.test.ts
// pattern.

const TABLES = { alerts: 'a', contact: 'c', analytics: 'an' };
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
      if (existing && existing.status !== input.ExpressionAttributeValues[':resolved']) {
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
      return { Items: aggRows.filter((r) => r.s >= from && r.s <= to).map((r) => ({ k: 'agg', s: r.s, count: r.count })) };
    }
    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return { client: { send } as unknown as DynamoDBDocumentClient, alerts, contactRows, aggRows };
}

function makePair() {
  const sim = simulatedDdb();
  return {
    dummy: new InMemorySupportBotStorage(() => T0),
    ddb: new DynamoSupportBotStorage(sim.client, TABLES),
    sim,
  };
}

describe('support-bot dummy ↔ DynamoDB parity (rule 2)', () => {
  it('produces identical putAlert outcomes + final alert state for an identical sequence', async () => {
    const { dummy, ddb } = makePair();
    const run = async (storage: SupportBotStorage) => [
      await storage.putAlert(alert('a1')), // fresh → true
      await storage.putAlert(alert('a1')), // open dup → false
      await storage.putAlert(alert('a2')), // fresh → true
      await storage.putAlert(alert('a2', { status: 'open', title: 'overwriter' })), // still false
    ];
    const dummyOutcomes = await run(dummy);
    const ddbOutcomes = await run(ddb);
    expect(dummyOutcomes).toEqual([true, false, true, false]);
    expect(ddbOutcomes).toEqual(dummyOutcomes);

    // Final visible state agrees (the refused overwrite never landed).
    expect(await dummy.getAlert('a1')).toEqual(await ddb.getAlert('a1'));
    expect((await dummy.getAlert('a2'))?.title).toBe('t');
    expect(await dummy.getAlert('missing')).toEqual(await ddb.getAlert('missing'));
  });

  it('re-open after resolve lands on both implementations', async () => {
    const { dummy, ddb, sim } = makePair();
    await dummy.putAlert(alert('a1'));
    await ddb.putAlert(alert('a1'));
    // Admin resolves (out-of-band write on both sides).
    (dummy as unknown as { alerts: Map<string, Alert> }).alerts.set('a1', { ...alert('a1'), status: 'resolved' });
    sim.alerts.set('a1', { ...alert('a1'), status: 'resolved' });

    const reopened = alert('a1', { title: 'again' });
    expect(await dummy.putAlert(reopened)).toBe(true);
    expect(await ddb.putAlert(reopened)).toBe(true);
    expect(await dummy.getAlert('a1')).toEqual(await ddb.getAlert('a1'));
    expect((await dummy.getAlert('a1'))?.title).toBe('again');
  });

  it('listNewContactMessages returns the same status="new" rows on both', async () => {
    const { dummy, ddb, sim } = makePair();
    const messages = [message('m1'), message('m2', 'read'), message('m3'), message('m4', 'spam')];
    for (const m of messages) {
      await dummy.saveContactMessage(m); // the contact ingest write path (inherited)
      sim.contactRows.push({ ...m }); // the same rows, written by the contact Lambda in prod
    }
    const dummyRows = await dummy.listNewContactMessages();
    const ddbRows = await ddb.listNewContactMessages();
    expect(dummyRows).toEqual(ddbRows);
    expect(dummyRows.map((m) => m.messageId).sort()).toEqual(['m1', 'm3']);
  });

  it('getAggregatesBetween returns the same window rows on both', async () => {
    const { dummy, ddb, sim } = makePair();
    // The dummy path: recordEvent (inherited from the analytics dummy) writes
    // the SAME four aggregate rows the analytics Lambda's adapter would.
    await dummy.recordEvent({
      name: 'page_view',
      props: {},
      urlPath: '/',
      referrer: '',
      host: 'octavlearning.com',
      sessionId: 'sess-1',
      ua: 'ua',
      clientTs: '2026-09-25T10:00:00.000Z',
    });
    // The prod side: those rows as the analytics Lambda wrote them.
    sim.aggRows.push(
      { s: '2026-09-25#event#page_view', count: 1 },
      { s: '2026-09-25#host#octavlearning.com', count: 1 },
      { s: '2026-09-25#page#/', count: 1 },
      { s: '2026-09-25#referrer#direct', count: 1 },
      { s: '2026-10-01#event#page_view', count: 9 } // outside the window
    );
    const dummyRows = await dummy.getAggregatesBetween('2026-09-24', '2026-09-26');
    const ddbRows = await ddb.getAggregatesBetween('2026-09-24', '2026-09-26');
    const sort = (rows: Array<{ s: string; count: number }>) => [...rows].sort((a, b) => a.s.localeCompare(b.s));
    expect(sort(dummyRows)).toEqual(sort(ddbRows));
    expect(dummyRows).toHaveLength(4);
  });

  it('probeSupportAlertsTable resolves on both implementations', async () => {
    const { dummy, ddb } = makePair();
    await expect(dummy.probeSupportAlertsTable()).resolves.toBeUndefined();
    await expect(ddb.probeSupportAlertsTable()).resolves.toBeUndefined();
  });

  it('the dummy continues the shared in-memory universe chain (auth → … → contact)', async () => {
    const storage = new InMemorySupportBotStorage();
    expect(storage).toBeInstanceOf(InMemoryContactStorage);
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
    expect((await storage.getUserById('u1'))?.email).toBe('a@example.com');
  });

  it('getAlert returns a COPY — mutating it cannot corrupt the store', async () => {
    const dummy = new InMemorySupportBotStorage(() => T0);
    await dummy.putAlert(alert('a1'));
    const read = await dummy.getAlert('a1');
    read!.status = 'muted';
    expect((await dummy.getAlert('a1'))?.status).toBe('open');
  });
});
