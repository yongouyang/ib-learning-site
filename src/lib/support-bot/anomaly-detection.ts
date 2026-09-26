import { parseAggregateKey, utcDate } from '../analytics/types';
import type { AnalyticsAggregateItem } from '../analytics/types';
import type { AnalyticsAnomalySignal } from './types';
import { analyticsDedupKey } from './types';

// Analytics anomaly detection (plan §3.2) — a PURE fold of the daily
// aggregate rows (k="agg", s="<date>#<kind>#<key>") into anomaly signals, so
// dummy and DynamoDB can never diverge on the math (the buildSummary/
// buildReport parity lesson). Both storage adapters hand their rows here.
//
// GRANULARITY DEVIATION (recorded): §3.2 specifies hourly windows ("1h
// window", ">2 consecutive hours") but the aggregate rows are DAY-keyed — the
// same reality the analytics-report honesty notes record. Detection therefore
// runs on the latest COMPLETE UTC day (yesterday) against a 7-day baseline of
// the complete days before it. Today's partial day is deliberately ignored
// (a 00:05 UTC run would otherwise compare 5 minutes against full days).
//
// DORMANT SIGNALS (recorded): two of the four §3.2 signals have no data
// source in the CURRENT analytics taxonomy (ANALYTICS_EVENT_NAMES):
//   - error_spike: no error event is ingested (ERROR_EVENT_NAMES below is the
//     seam — when the taxonomy gains one, detection lights up unchanged);
//   - ai_quota_exhaustion: the feedback 429 is not an analytics event and the
//     aimark rate-limit bucket does not record exhaustion. The detector keys
//     off AI_QUOTA_EXCEEDED_EVENT_NAME and stays silent until that event
//     exists (recommended v1.1 addition).
// Both detectors are implemented and unit-tested against synthetic rows, so
// adding the event name to the ingest taxonomy is the ONLY change needed.

export const ANOMALY_DAY_MS = 86_400_000;
/** Baseline window: the 7 complete UTC days before the subject day. */
export const ANOMALY_BASELINE_DAYS = 7;

/** §3.2: error-rate spike >3× baseline. */
export const ERROR_SPIKE_MULTIPLIER = 3;
/** Floor so a 3× jump from a near-zero baseline does not alert on noise. */
export const ERROR_SPIKE_MIN_COUNT = 5;
/** DORMANT: event names counted as errors (none exist in the taxonomy yet). */
export const ERROR_EVENT_NAMES: readonly string[] = ['error'];

/** §3.2: traffic drop >50% vs the 7-day average. */
export const TRAFFIC_DROP_RATIO = 0.5;
/** Floor: a site averaging under this many prod events/day never alerts. */
export const TRAFFIC_DROP_MIN_BASELINE = 20;

/** §3.2: AI-mark quota exhaustion rate >20%/day — of the day's AI-mark volume. */
export const AI_QUOTA_EXHAUSTION_RATIO = 0.2;
/** Floor: ratio is only meaningful once the day has this many AI marks. */
export const AI_QUOTA_MIN_MARKS = 5;
/** DORMANT: the exhaustion event name (not in the ingest taxonomy yet). */
export const AI_QUOTA_EXCEEDED_EVENT_NAME = 'ai_mark_quota_exceeded';
export const AI_MARK_EVENT_NAME = 'paper_marked_with_ai';

/** §3.2: zero prod events — only when the site normally HAS traffic. */
export const ZERO_EVENTS_MIN_BASELINE = 1;

function addToNested(map: Map<string, Map<string, number>>, date: string, key: string, count: number): void {
  const byKey = map.get(date) ?? new Map<string, number>();
  byKey.set(key, (byKey.get(key) ?? 0) + count);
  map.set(date, byKey);
}

function countFor(map: Map<string, Map<string, number>>, date: string, keys: readonly string[]): number {
  const byKey = map.get(date);
  if (!byKey) return 0;
  let total = 0;
  for (const key of keys) total += byKey.get(key) ?? 0;
  return total;
}

function baselineAvg(dates: string[], valueFor: (date: string) => number): number {
  // Missing days count as 0 — a day with no aggregate rows genuinely had no events.
  return dates.reduce((sum, d) => sum + valueFor(d), 0) / ANOMALY_BASELINE_DAYS;
}

/**
 * Fold aggregate rows into §3.2 anomaly signals. PURE. The subject day is the
 * latest COMPLETE UTC day; the baseline is the 7 complete days before it.
 */
export function detectAnalyticsAnomalies(
  aggregates: Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>,
  opts: { nowMs: number; prodHost: string }
): AnalyticsAnomalySignal[] {
  const { nowMs, prodHost } = opts;
  const subjectDate = utcDate(nowMs - ANOMALY_DAY_MS);
  const baselineDates: string[] = [];
  for (let i = 2; i <= ANOMALY_BASELINE_DAYS + 1; i++) {
    baselineDates.push(utcDate(nowMs - i * ANOMALY_DAY_MS));
  }

  const eventsByDate = new Map<string, Map<string, number>>(); // date → event name → count
  const hostsByDate = new Map<string, Map<string, number>>(); // date → host → count
  for (const { s, count } of aggregates) {
    const { date, kind, key } = parseAggregateKey(s);
    if (kind === 'event') addToNested(eventsByDate, date, key, count);
    else if (kind === 'host') addToNested(hostsByDate, date, key, count);
  }

  const signal = (
    kind: AnalyticsAnomalySignal['kind'],
    count: number,
    baseline: number,
    context?: Record<string, string>
  ): AnalyticsAnomalySignal => ({
    source: 'analytics',
    kind,
    dedupKey: analyticsDedupKey(kind, subjectDate),
    sourceRef: `agg:${subjectDate}`,
    subjectDate,
    count,
    baseline,
    ...(context ? { context } : {}),
  });

  const signals: AnalyticsAnomalySignal[] = [];

  // §3.2 error-rate spike (>3× baseline). DORMANT until the taxonomy ingests
  // an error event (see the header note).
  const errorCount = countFor(eventsByDate, subjectDate, ERROR_EVENT_NAMES);
  const errorBaseline = baselineAvg(baselineDates, (d) => countFor(eventsByDate, d, ERROR_EVENT_NAMES));
  if (errorCount >= ERROR_SPIKE_MIN_COUNT && errorCount > ERROR_SPIKE_MULTIPLIER * errorBaseline) {
    signals.push(signal('error_spike', errorCount, errorBaseline));
  }

  // §3.2 traffic drop (>50% vs 7-day avg) — prod-host EVENT volume (DAU is
  // not computable from anonymous aggregates; deviation recorded above).
  const prodCount = countFor(hostsByDate, subjectDate, [prodHost]);
  const prodBaseline = baselineAvg(baselineDates, (d) => countFor(hostsByDate, d, [prodHost]));
  if (prodBaseline >= TRAFFIC_DROP_MIN_BASELINE && prodCount < TRAFFIC_DROP_RATIO * prodBaseline) {
    signals.push(signal('traffic_drop', prodCount, prodBaseline));
  }

  // §3.2 zero events — a complete day with NO prod events while the site
  // normally has traffic. (The "2 consecutive hours" form is impossible with
  // day-keyed aggregates; deviation recorded above.)
  if (prodCount === 0 && prodBaseline >= ZERO_EVENTS_MIN_BASELINE) {
    signals.push(signal('zero_events', prodCount, prodBaseline));
  }

  // §3.2 AI-mark quota exhaustion >20% of the day's AI-mark volume. DORMANT
  // until the exhaustion event exists (see the header note).
  const markCount = countFor(eventsByDate, subjectDate, [AI_MARK_EVENT_NAME]);
  const exhaustedCount = countFor(eventsByDate, subjectDate, [AI_QUOTA_EXCEEDED_EVENT_NAME]);
  if (markCount >= AI_QUOTA_MIN_MARKS && exhaustedCount > AI_QUOTA_EXHAUSTION_RATIO * markCount) {
    signals.push(
      signal('ai_quota_exhaustion', exhaustedCount, markCount, {
        marks: String(markCount),
        ratio: (exhaustedCount / markCount).toFixed(2),
      })
    );
  }

  return signals;
}
