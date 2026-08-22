import { describe, it, expect } from 'vitest';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import { DynamoAnalyticsStorage } from '@/lib/analytics/dynamodb-storage';
import type { NormalizedAnalyticsEvent } from '@/lib/analytics/types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Rule 2 (the key test): the in-memory dummy must produce the SAME aggregate
// counts and the SAME budget allow/deny outcomes as the DynamoDB adapter for
// an identical event sequence. The simulated DocumentClient below is an
// INDEPENDENT re-implementation of the aggregate ADD-upsert and fixed-window
// budget semantics (it never calls the adapter) — if the dummy's mirror ever
// drifts from the adapter's commands, the summaries or the budget sequences
// diverge here.

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

// --- Simulated DynamoDB --------------------------------------------------------

function simulatedDdb() {
  const items = new Map<string, Record<string, unknown>>();
  const keyOf = (k: string, s: string) => `${k}\u0000${s}`;

  const fail = () => {
    const err = new Error('The conditional request failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  };

  const send = async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const { input } = cmd;

    if (cmd.constructor.name === 'PutCommand') {
      const item = input.Item;
      items.set(keyOf(item.k, item.s), { ...item });
      return {};
    }

    if (cmd.constructor.name === 'UpdateCommand') {
      if (input.Key.bucket !== undefined) {
        // Fixed-window budget (octav-rate-limits): count < limit within the
        // window bucket; condition evaluates the PRE-update item.
        const k = input.Key.bucket as string;
        const existing = items.get(k);
        const count = existing ? (existing.count as number) : 0;
        if (existing && count >= (input.ExpressionAttributeValues[':limit'] as number)) fail();
        items.set(k, {
          bucket: k,
          count: (existing ? (existing.count as number) : 0) + (input.ExpressionAttributeValues[':inc'] as number),
          expiresAt: input.ExpressionAttributeValues[':exp'],
        });
        return {};
      }
      // Aggregate ADD upsert: count += 1, expiresAt slides to now+400d.
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
      const from = input.ExpressionAttributeValues[':from'] as string | undefined;
      const to = input.ExpressionAttributeValues[':to'] as string | undefined;
      const all: Record<string, unknown>[] = [];
      for (const [k, v] of items) {
        if (!k.startsWith(prefix)) continue;
        const sk = (v.s as string) ?? '';
        if (from !== undefined && to !== undefined && !(sk >= from && sk <= to)) continue;
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

  return { send } as unknown as DynamoDBDocumentClient;
}

// --- One sequence, driven against either storage --------------------------------

function event(overrides: Partial<NormalizedAnalyticsEvent>): NormalizedAnalyticsEvent {
  return {
    name: 'page_view',
    props: {},
    urlPath: '/',
    referrer: 'google.com',
    host: 'octavlearning.com',
    sessionId: 'sess-1',
    ua: 'TestAgent',
    clientTs: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

const EVENT_SEQUENCE: NormalizedAnalyticsEvent[] = [
  event({ name: 'page_view', urlPath: '/subjects/math', referrer: 'google.com', clientTs: '2026-08-15T10:00:00.000Z' }),
  event({ name: 'page_view', urlPath: '/subjects/math', referrer: 'google.com', clientTs: '2026-08-15T10:05:00.000Z' }),
  event({ name: 'quiz_started', urlPath: '/subjects/math/math-yr7-algebra-1/quiz', referrer: '', clientTs: '2026-08-15T10:10:00.000Z' }),
  event({
    name: 'quiz_completed',
    props: { subjectId: 'math', topicId: 'math-yr7-algebra-1', correctCount: 8, totalCount: 10, durationSeconds: 40 },
    urlPath: '/subjects/math/math-yr7-algebra-1/quiz',
    referrer: 'octavlearning.com',
    clientTs: '2026-08-15T10:15:00.000Z',
  }),
  event({ name: 'page_view', urlPath: '/exams', referrer: 'bing.com', host: 'dev.octavlearning.com', clientTs: '2026-08-16T09:00:00.000Z' }),
  event({ name: 'auth_logout', urlPath: '/account', referrer: '', clientTs: '2026-08-16T09:05:00.000Z' }),
];

async function runSequence(storage: InMemoryAnalyticsStorage | DynamoAnalyticsStorage) {
  for (const e of EVENT_SEQUENCE) {
    await storage.recordEvent(e);
  }
  return {
    summary7: await storage.getSummary(7),
    summary30: await storage.getSummary(30),
  };
}

const SESSION_SUBSET = {
  getSession: async () => null,
  getUserById: async () => null,
  updateSession: async () => {},
  deleteSession: async () => {},
};

describe('dummy ↔ DynamoDB analytics parity (rule 2)', () => {
  it('produces identical summaries for the same event sequence', async () => {
    const dummy = await runSequence(new InMemoryAnalyticsStorage(() => NOW_MS));
    const ddb = await runSequence(
      new DynamoAnalyticsStorage(
        simulatedDdb(),
        { users: 'u', sessions: 's', events: 'e', rateLimits: 'r' },
        SESSION_SUBSET,
        () => NOW_MS
      )
    );

    expect(dummy.summary7).toEqual(ddb.summary7);
    expect(dummy.summary30).toEqual(ddb.summary30);

    // Sanity on the actual values (not just agreement).
    expect(dummy.summary7.dailySeries.page_view).toEqual({ '2026-08-15': 2, '2026-08-16': 1 });
    expect(dummy.summary7.totals.quiz_completed).toBe(1);
    expect(dummy.summary7.hosts).toEqual({ 'dev.octavlearning.com': 1, 'octavlearning.com': 5 });
  });

  it('produces identical budget allow/deny sequences across a window rollover', async () => {
    let now = 1_000;
    const clock = () => now;
    const dummy = new InMemoryAnalyticsStorage(clock);
    const ddb = new DynamoAnalyticsStorage(
      simulatedDdb(),
      { users: 'u', sessions: 's', events: 'e', rateLimits: 'r' },
      SESSION_SUBSET,
      clock
    );

    const drive = async (storage: InMemoryAnalyticsStorage | DynamoAnalyticsStorage) => {
      now = 1_000; // reset the shared clock before each drive
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) results.push(await storage.incrementAnalyticsEventCount('ip', 3, 600));
      results.push(await storage.incrementAnalyticsEventCount('other-ip', 3, 600)); // own bucket
      now = 1_000 + 600_000; // window rolls
      results.push(await storage.incrementAnalyticsEventCount('ip', 3, 600));
      return results;
    };

    const dummyResults = await drive(dummy);
    const ddbResults = await drive(ddb);
    expect(dummyResults).toEqual([true, true, true, false, true, true]);
    expect(ddbResults).toEqual(dummyResults);
  });
});
