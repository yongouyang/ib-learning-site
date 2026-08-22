import { InMemoryProgressStorage } from '../progress/dummy';
import type {
  AnalyticsAggregateKind,
  AnalyticsStorage,
  AnalyticsSummary,
  NormalizedAnalyticsEvent,
  RawAnalyticsEventItem,
} from './types';
import {
  ANALYTICS_AGGREGATE_KINDS,
  ANALYTICS_RAW_TTL_DAYS,
  aggregateSortKey,
  analyticsDateOf,
  buildSummary,
} from './types';

// In-memory analytics dummy — the controllable-dummy directive (AGENTS.md):
// dev and e2e run against this with zero AWS resources. It EXTENDS the
// progress dummy (which extends the auth dummy), so the ONE shared in-memory
// universe serves auth sessions, progress items AND analytics events —
// the dev/e2e stand-in for the shared DynamoDB tables. Every write mirrors
// the DynamoDB adapter's semantics EXACTLY (same aggregate ADD outcomes,
// same fixed-window budget allow/deny) — the parity test drives both against
// a simulated DynamoDB implementation.

export class InMemoryAnalyticsStorage extends InMemoryProgressStorage implements AnalyticsStorage {
  private readonly rawEvents: RawAnalyticsEventItem[] = [];
  private readonly aggregates = new Map<string, number>(); // sort key → count
  private readonly ingestCounters = new Map<string, number>(); // bucket key → count
  // The base class's clock is private — keep our own copy (seeded with the
  // SAME clock so inherited fixed-window limiter and these ops stay aligned).
  private readonly clockFn: () => number;

  constructor(clock: () => number = Date.now) {
    super(clock);
    this.clockFn = clock;
  }

  async recordEvent(event: NormalizedAnalyticsEvent): Promise<void> {
    const nowMs = this.clockFn();
    const date = analyticsDateOf(event.clientTs);
    const rawS = `${date}#${Date.parse(event.clientTs)}#${crypto.randomUUID()}`;
    this.rawEvents.push({
      k: 'ev',
      s: rawS,
      name: event.name,
      props: { ...event.props },
      host: event.host,
      sessionId: event.sessionId,
      ua: event.ua,
      expiresAt: Math.floor(nowMs / 1000) + ANALYTICS_RAW_TTL_DAYS * 86_400,
    });

    // Mirrors the DynamoDB ADD upsert: one counter per (date, kind, key).
    for (const kind of ANALYTICS_AGGREGATE_KINDS) {
      const key = this.aggregateKeyFor(event, kind);
      const s = aggregateSortKey(date, kind, key);
      this.aggregates.set(s, (this.aggregates.get(s) ?? 0) + 1);
    }
  }

  async incrementAnalyticsEventCount(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Fixed-window budget with the window epoch IN the key — mirrors the auth
    // limiter and the DynamoDB bucket design: the counter resets atomically
    // when the window rolls (the previous bucket is simply never read again).
    const windowMs = windowSeconds * 1000;
    const epoch = Math.floor(this.clockFn() / windowMs);
    const key = `analytics:${ip}:${epoch}`;
    const count = this.ingestCounters.get(key) ?? 0;
    if (count >= limit) return false;
    this.ingestCounters.set(key, count + 1);
    return true;
  }

  async getSummary(days: number): Promise<AnalyticsSummary> {
    const aggregates = [...this.aggregates.entries()].map(([s, count]) => ({ s, count }));
    return buildSummary(aggregates, days, this.clockFn());
  }

  async probeAnalyticsTable(): Promise<void> {
    // The in-memory dummy has no IAM/table to fail — the probe is a no-op
    // (its DynamoDB counterpart performs the Limit-1 Query).
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
