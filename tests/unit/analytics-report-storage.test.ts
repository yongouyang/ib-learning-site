import { describe, it, expect } from 'vitest';
import { InMemoryAnalyticsReportStorage } from '@/lib/analytics-report/dummy';
import { DynamoAnalyticsReportStorage } from '@/lib/analytics-report/dynamodb-storage';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import { DynamoAnalyticsStorage } from '@/lib/analytics/dynamodb-storage';
import { buildReport } from '@/lib/analytics-report/types';
import type { NormalizedAnalyticsEvent } from '@/lib/analytics/types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Rule 2 (parity): the report's in-memory dummy must hand the PURE builder the
// SAME aggregate rows the DynamoDB adapter's BETWEEN query returns for an
// identical event sequence. The simulated DocumentClient is an INDEPENDENT
// re-implementation of the aggregate ADD-upsert + Query semantics (it never
// calls the adapters) — the same harness as analytics-parity.test.ts,
// truncated to the report's needs.

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

// The simulated DocumentClient: `send` accepts ANY command-shaped object (the
// direct-seed tests pass hand-built UpdateCommand shapes); the adapters receive
// it cast to DynamoDBDocumentClient.
interface SimulatedDdb {
  send(cmd: { constructor: { name: string }; input: Record<string, any> }): Promise<Record<string, unknown>>;
}

function simulatedDdb(): SimulatedDdb {
  const items = new Map<string, Record<string, unknown>>();
  const keyOf = (k: string, s: string) => `${k}\u0000${s}`;

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;
    if (cmd.constructor.name === 'PutCommand') {
      const item = input.Item as Record<string, unknown>;
      items.set(keyOf(item.k as string, item.s as string), { ...item });
      return {};
    }
    if (cmd.constructor.name === 'UpdateCommand') {
      const k = keyOf(input.Key.k, input.Key.s);
      const existing = items.get(k);
      items.set(k, {
        ...(existing ?? {}),
        k: input.Key.k,
        s: input.Key.s,
        count: (existing ? (existing.count as number) : 0) + (input.ExpressionAttributeValues[':one'] as number),
        expiresAt: input.ExpressionAttributeValues[':exp'],
      });
      return {};
    }
    if (cmd.constructor.name === 'QueryCommand') {
      const kValue = input.ExpressionAttributeValues[':k'] as string;
      const prefix = `${kValue}\u0000`;
      const from = input.ExpressionAttributeValues[':from'] as string;
      const to = input.ExpressionAttributeValues[':to'] as string;
      const all: Record<string, unknown>[] = [];
      for (const [k, v] of items) {
        if (!k.startsWith(prefix)) continue;
        const sk = (v.s as string) ?? '';
        if (!(sk >= from && sk <= to)) continue;
        all.push(v);
      }
      // Page at 2 items — the adapter must loop LastEvaluatedKey.
      const startKey = input.ExclusiveStartKey as { s: string } | undefined;
      let startIdx = 0;
      if (startKey) {
        startIdx = all.findIndex((i) => i.s === startKey.s);
        if (startIdx === -1) return { Items: [] };
        startIdx += 1;
      }
      const PAGE = 2;
      const page = all.slice(startIdx, startIdx + PAGE);
      if (startIdx + PAGE < all.length) {
        return { Items: page, LastEvaluatedKey: { k: kValue, s: page[page.length - 1].s } };
      }
      return { Items: page };
    }
    throw new Error(`unexpected command: ${cmd.constructor.name}`);
  };

  return { send };
}

function event(overrides: Partial<NormalizedAnalyticsEvent>): NormalizedAnalyticsEvent {
  return {
    name: 'page_view',
    props: {},
    urlPath: '/',
    referrer: 'direct',
    host: 'octavlearning.com',
    sessionId: 'sess-1',
    ua: 'TestAgent',
    clientTs: '2026-08-16T10:00:00.000Z',
    ...overrides,
  };
}

const SEQUENCE: NormalizedAnalyticsEvent[] = [
  event({ name: 'page_view', urlPath: '/', clientTs: '2026-08-15T10:00:00.000Z' }),
  event({ name: 'page_view', urlPath: '/', clientTs: '2026-08-15T11:00:00.000Z' }),
  event({ name: 'quiz_completed', props: { subjectId: 'math' }, urlPath: '/quiz', clientTs: '2026-08-16T09:00:00.000Z' }),
  event({ name: 'page_view', urlPath: '/exams', host: 'dev.octavlearning.com', clientTs: '2026-08-16T09:05:00.000Z' }),
];

// Seed events through the ANALYTICS storage adapters (they own recordEvent),
// then hand the resulting state to the REPORT adapter — exactly the prod
// topology (the analytics Lambda writes the table the report Lambda reads).
async function seedDummy(): Promise<InMemoryAnalyticsReportStorage> {
  const universe = new InMemoryAnalyticsStorage(() => NOW_MS);
  for (const e of SEQUENCE) await universe.recordEvent(e);
  return new InMemoryAnalyticsReportStorage(universe);
}

async function seedDdb(): Promise<DynamoAnalyticsReportStorage> {
  const ddb = simulatedDdb();
  const writer = new DynamoAnalyticsStorage(
    ddb as unknown as DynamoDBDocumentClient,
    { users: 'u', sessions: 's', events: 'e', rateLimits: 'r' },
    { getSession: async () => null, getUserById: async () => null, updateSession: async () => {}, deleteSession: async () => {} },
    () => NOW_MS
  );
  for (const e of SEQUENCE) await writer.recordEvent(e);
  return new DynamoAnalyticsReportStorage(ddb as unknown as DynamoDBDocumentClient, 'e');
}

describe('analytics-report storage parity (rule 2)', () => {
  it('returns identical aggregate rows for the same event sequence', async () => {
    const dummy = await seedDummy();
    const ddb = await seedDdb();

    const dummyRows = await dummy.getAggregatesBetween('2026-08-15', '2026-08-16');
    const ddbRows = await ddb.getAggregatesBetween('2026-08-15', '2026-08-16');

    expect(dummyRows).toEqual(ddbRows);
    // Sanity on actual values: 4 events → event/page/referrer/host rows.
    const report = buildReport(dummyRows, { fromDate: '2026-08-15', toDate: '2026-08-16', host: 'octavlearning.com', nowMs: NOW_MS });
    expect(report.totals).toEqual({ page_view: 3, quiz_completed: 1 });
    expect(report.hosts).toEqual({ 'octavlearning.com': 3, 'dev.octavlearning.com': 1 });
    expect(report.prodEvents).toBe(3);
    expect(report.totalEvents).toBe(4);
  });

  it('loops LastEvaluatedKey past the simulated 2-item page size', async () => {
    const ddb = simulatedDdb();
    // 5 identical aggregate rows (only 1 key — the ADD-upsert sums them).
    for (let i = 0; i < 5; i++) {
      await ddb.send({
        constructor: { name: 'UpdateCommand' },
        input: {
          Key: { k: 'agg', s: '2026-08-16#event#page_view' },
          ExpressionAttributeValues: { ':one': 1, ':exp': 0 },
        },
      });
    }
    // Distinct sort keys force >1 page: 3 separate keys × 1 each, page size 2.
    for (const key of ['2026-08-16#event#quiz_completed', '2026-08-16#page#/x', '2026-08-16#host#octavlearning.com']) {
      await ddb.send({
        constructor: { name: 'UpdateCommand' },
        input: { Key: { k: 'agg', s: key }, ExpressionAttributeValues: { ':one': 1, ':exp': 0 } },
      });
    }
    const storage = new DynamoAnalyticsReportStorage(ddb as unknown as DynamoDBDocumentClient, 'e');
    const rows = await storage.getAggregatesBetween('2026-08-16', '2026-08-16');
    expect(rows).toEqual([
      { s: '2026-08-16#event#page_view', count: 5 },
      { s: '2026-08-16#event#quiz_completed', count: 1 },
      { s: '2026-08-16#page#/x', count: 1 },
      { s: '2026-08-16#host#octavlearning.com', count: 1 },
    ]);
  });

  it('returns nothing outside the requested window', async () => {
    const dummy = await seedDummy();
    const rows = await dummy.getAggregatesBetween('2026-09-01', '2026-09-02');
    expect(rows).toEqual([]);
  });
});
