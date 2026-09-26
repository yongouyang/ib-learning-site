import { describe, it, expect } from 'vitest';
import {
  AI_QUOTA_EXCEEDED_EVENT_NAME,
  detectAnalyticsAnomalies,
} from '@/lib/support-bot/anomaly-detection';

// Anomaly detection (plan §3.2) over the day-keyed aggregate rows. The subject
// day is the latest COMPLETE UTC day (yesterday); the baseline is the 7
// complete days before it.
//
// T0 = 2026-09-26T12:00:00Z → subject day 2026-09-25, baseline 2026-09-18..24.

const T0 = Date.parse('2026-09-26T12:00:00.000Z');
const SUBJECT = '2026-09-25';
const BASELINE_DAYS = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
const PROD = 'octavlearning.com';

function agg(date: string, kind: 'event' | 'host', key: string, count: number) {
  return { s: `${date}#${kind}#${key}`, count };
}

function detect(rows: Array<{ s: string; count: number }>, nowMs: number = T0) {
  return detectAnalyticsAnomalies(rows, { nowMs, prodHost: PROD });
}

/** 7-day prod-host baseline of `perDay` events/day + a subject-day count. */
function prodTraffic(perDay: number, subjectDay: number) {
  return [
    ...BASELINE_DAYS.map((d) => agg(d, 'host', PROD, perDay)),
    agg(SUBJECT, 'host', PROD, subjectDay),
  ];
}

describe('detectAnalyticsAnomalies — error_spike (dormant until an error event exists)', () => {
  it('fires when the subject day exceeds 3× the baseline and the min count', () => {
    const rows = [...BASELINE_DAYS.map((d) => agg(d, 'event', 'error', 5)), agg(SUBJECT, 'event', 'error', 20)];
    const signals = detect(rows);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      source: 'analytics',
      kind: 'error_spike',
      dedupKey: `analytics:error_spike:${SUBJECT}`,
      sourceRef: `agg:${SUBJECT}`,
      subjectDate: SUBJECT,
      count: 20,
      baseline: 5,
    });
  });

  it('stays silent at exactly 3× the baseline', () => {
    const rows = [...BASELINE_DAYS.map((d) => agg(d, 'event', 'error', 5)), agg(SUBJECT, 'event', 'error', 15)];
    expect(detect(rows)).toEqual([]);
  });

  it('stays silent below the min-count floor even from a zero baseline', () => {
    expect(detect([agg(SUBJECT, 'event', 'error', 4)])).toEqual([]);
    // …but a zero baseline does not suppress a real spike.
    const signals = detect([agg(SUBJECT, 'event', 'error', 5)]);
    expect(signals.map((s) => s.kind)).toEqual(['error_spike']);
  });

  it('ignores events from the partial TODAY (only complete days count)', () => {
    expect(detect([agg('2026-09-26', 'event', 'error', 500)])).toEqual([]);
  });
});

describe('detectAnalyticsAnomalies — traffic_drop', () => {
  it('fires on a >50% prod-traffic drop vs the 7-day average', () => {
    const signals = detect(prodTraffic(100, 30));
    const drop = signals.find((s) => s.kind === 'traffic_drop');
    expect(drop).toMatchObject({ count: 30, baseline: 100, dedupKey: `analytics:traffic_drop:${SUBJECT}` });
  });

  it('stays silent at exactly 50% of the baseline', () => {
    expect(detect(prodTraffic(100, 50)).find((s) => s.kind === 'traffic_drop')).toBeUndefined();
  });

  it('stays silent below the baseline floor (a tiny site never flaps)', () => {
    // avg 10/day < TRAFFIC_DROP_MIN_BASELINE — even a drop to 0 is not a
    // traffic_drop (zero_events still fires — the site normally HAS traffic).
    const kinds = detect(prodTraffic(10, 0)).map((s) => s.kind);
    expect(kinds).not.toContain('traffic_drop');
    expect(kinds).toContain('zero_events');
  });

  it('is scoped to the prod host — dev traffic does not count', () => {
    const rows = [
      ...BASELINE_DAYS.map((d) => agg(d, 'host', 'dev.octavlearning.com', 500)),
      agg(SUBJECT, 'host', 'dev.octavlearning.com', 500),
    ];
    expect(detect(rows)).toEqual([]);
  });
});

describe('detectAnalyticsAnomalies — zero_events', () => {
  it('fires on a complete day with zero prod events when the site normally has traffic', () => {
    const kinds = detect(prodTraffic(100, 0)).map((s) => s.kind);
    // Both the drop and the zero signal fire for the same subject day — they
    // are distinct kinds with distinct dedup keys.
    expect(kinds).toEqual(expect.arrayContaining(['traffic_drop', 'zero_events']));
  });

  it('stays silent when the site never had traffic (baseline 0)', () => {
    expect(detect([])).toEqual([]);
  });

  it('stays silent when the subject day has any prod events', () => {
    const kinds = detect(prodTraffic(100, 1)).map((s) => s.kind);
    expect(kinds).not.toContain('zero_events');
    // …but a 99% drop is still a traffic_drop.
    expect(kinds).toContain('traffic_drop');
  });
});

describe('detectAnalyticsAnomalies — ai_quota_exhaustion (dormant until the event exists)', () => {
  const marks = (date: string, n: number) => agg(date, 'event', 'paper_marked_with_ai', n);
  const exhausted = (date: string, n: number) => agg(date, 'event', AI_QUOTA_EXCEEDED_EVENT_NAME, n);

  it('fires when >20% of the day\'s AI-mark volume hit the quota', () => {
    const signals = detect([marks(SUBJECT, 10), exhausted(SUBJECT, 3)]);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      kind: 'ai_quota_exhaustion',
      count: 3,
      baseline: 10, // the day's AI-mark volume (the ratio denominator)
      dedupKey: `analytics:ai_quota_exhaustion:${SUBJECT}`,
    });
    expect(signals[0].context).toEqual({ marks: '10', ratio: '0.30' });
  });

  it('stays silent at exactly 20%', () => {
    expect(detect([marks(SUBJECT, 10), exhausted(SUBJECT, 2)])).toEqual([]);
  });

  it('stays silent below the min-marks floor (a 1/1 day is not 100% exhaustion)', () => {
    expect(detect([marks(SUBJECT, 4), exhausted(SUBJECT, 4)])).toEqual([]);
  });
});
