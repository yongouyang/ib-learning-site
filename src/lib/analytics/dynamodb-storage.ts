import { randomUUID } from 'node:crypto';
import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, UserRecord } from '../auth/types';
import type {
  AnalyticsAggregateItem,
  AnalyticsAggregateKind,
  AnalyticsStorage,
  AnalyticsSummary,
  NormalizedAnalyticsEvent,
} from './types';
import {
  ANALYTICS_AGG_TTL_DAYS,
  ANALYTICS_MAX_UA,
  ANALYTICS_RAW_TTL_DAYS,
  aggregateSortKey,
  analyticsDateOf,
  buildSummary,
  utcDate,
} from './types';

// Production analytics adapter: the AnalyticsStorage contract on
// octav-analytics-events (PK `k`, SK `s`) + octav-rate-limits (PK `bucket`).
// The session-validation subset is delegated to the SAME DynamoSessionStorage
// the auth/progress Lambdas use (one source of truth for session reads/writes
// — src/lib/auth/session.ts). Write semantics per event:
//   1 PutCommand   raw event (k="ev", append-only by uuid SK, TTL now+90d)
//   4 UpdateCommands  one ADD-upsert per aggregate kind (event/page/referrer/
//                     host) — atomic counters, TTL now+400d
// The ingest budget mirrors the auth fixed-window limiter (window epoch in
// the bucket key, ONE conditional UpdateCommand).

interface TableNames {
  users: string;
  sessions: string;
  events: string;
  rateLimits: string;
}

/** Session subset delegate (same implementation the auth handler uses). */
interface SessionSubset {
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoAnalyticsStorage implements AnalyticsStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames,
    private readonly sessionStorage: SessionSubset,
    private readonly clock: () => number = Date.now
  ) {}

  // --- Session subset (delegated — src/lib/auth/session.ts) --------------------

  getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessionStorage.getSession(sessionId);
  }

  getUserById(userId: string): Promise<UserRecord | null> {
    return this.sessionStorage.getUserById(userId);
  }

  updateSession(sessionId: string, updates: { lastAccessedAt: string; expiresAt: number }): Promise<void> {
    return this.sessionStorage.updateSession(sessionId, updates);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.sessionStorage.deleteSession(sessionId);
  }

  // --- Events -------------------------------------------------------------------

  async recordEvent(event: NormalizedAnalyticsEvent): Promise<void> {
    // The handler normalizes BEFORE calling here: url is path-only, referrer
    // is host-only or "direct", host comes from the request, ua is truncated.
    const nowMs = this.clock();
    const date = analyticsDateOf(event.clientTs);
    const rawS = `${date}#${Date.parse(event.clientTs)}#${randomUUID()}`;

    await this.client.send(
      new PutCommand({
        TableName: this.tables.events,
        Item: {
          k: 'ev',
          s: rawS,
          name: event.name,
          props: event.props,
          host: event.host,
          sessionId: event.sessionId,
          ua: event.ua.slice(0, ANALYTICS_MAX_UA),
          expiresAt: Math.floor(nowMs / 1000) + ANALYTICS_RAW_TTL_DAYS * 86_400,
        },
      })
    );

    // One ADD-upsert per aggregate kind: an atomic counter keyed by
    // (date, kind, key). expiresAt slides to now+400d on every increment, so
    // an active aggregate keeps a rolling 12-month window of data.
    const aggExpiresAt = Math.floor(nowMs / 1000) + ANALYTICS_AGG_TTL_DAYS * 86_400;
    for (const kind of ['event', 'page', 'referrer', 'host'] as const) {
      const s = aggregateSortKey(date, kind, this.aggregateKeyFor(event, kind));
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.events,
          Key: { k: 'agg', s },
          UpdateExpression: 'ADD #c :one SET expiresAt = :exp',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: { ':one': 1, ':exp': aggExpiresAt },
        })
      );
    }
  }

  // --- Ingest budget (octav-rate-limits) -----------------------------------------

  async incrementAnalyticsEventCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window counter with the window epoch IN the bucket key (the auth
    // limiter pattern): each window is a fresh item, so the counter resets
    // ATOMICALLY in a single UpdateCommand when the window rolls — no
    // dependence on TTL deletion (best-effort, up to ~48h lag).
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clock() / windowMs);
    const bucket = `analytics:${ip}:${epoch}`;
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.rateLimits,
          Key: { bucket },
          UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, expiresAt = :exp',
          // Condition evaluates the PRE-update item: events 1..limit succeed
          // and limit+1 fails — but only within THIS window's bucket.
          ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':limit': limit,
            ':exp': (epoch + 1) * windowSeconds, // TTL: end of this epoch window
          },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  // --- Summary -------------------------------------------------------------------

  async getSummary(days: number): Promise<AnalyticsSummary> {
    const nowMs = this.clock();
    const today = utcDate(nowMs);
    const oldest = utcDate(nowMs - (days - 1) * 86_400_000);

    // ONE Query over the aggregate partition, BETWEEN the window's first day
    // and today. "#" is the lowest printable delimiter and "~" sorts after
    // any printable key character, so `<oldest>#` / `<today>#~` bracket
    // exactly the window's sort keys. Looping LastEvaluatedKey collects every
    // page (never truncates — the listProgressByUser lesson).
    const items: AnalyticsAggregateItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tables.events,
          KeyConditionExpression: 'k = :k AND s BETWEEN :from AND :to',
          ExpressionAttributeValues: { ':k': 'agg', ':from': `${oldest}#`, ':to': `${today}#~` },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      items.push(...((res.Items ?? []) as AnalyticsAggregateItem[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    return buildSummary(items, days, nowMs);
  }

  async probeAnalyticsTable(): Promise<void> {
    // CI smoke: Limit-1 Query on a key that never exists. 200/void = the
    // table AND the Query grant work; AccessDenied/ResourceNotFound throws
    // (the handler converts that into a 500 for the smoke check).
    await this.client.send(
      new QueryCommand({
        TableName: this.tables.events,
        KeyConditionExpression: 'k = :probe',
        ExpressionAttributeValues: { ':probe': '__health_probe_nonexistent__' },
        Limit: 1,
      })
    );
  }

  // --- Internals ---------------------------------------------------------------

  private aggregateKeyFor(event: NormalizedAnalyticsEvent, kind: AnalyticsAggregateKind): string {
    switch (kind) {
      case 'event':
        return event.name;
      case 'page':
        return event.urlPath;
      case 'referrer':
        return event.referrer || 'direct';
      case 'host':
        return event.host;
    }
  }
}
