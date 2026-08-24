import { describe, it, expect } from 'vitest';
import { buildReport, ANALYTICS_REPORT_TOP_PAGES } from '@/lib/analytics-report/types';
import type { AnalyticsAggregateItem } from '@/lib/analytics/types';

// PURE buildReport math — the parity anchor for the report (same discipline as
// buildSummary in analytics-types.test.ts): deterministic folding, window
// filtering, and the prod-host headline numbers.

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

function agg(s: string, count: number): Pick<AnalyticsAggregateItem, 's' | 'count'> {
  return { s, count };
}

const ROWS = [
  agg('2026-08-15#event#page_view', 2),
  agg('2026-08-16#event#page_view', 3),
  agg('2026-08-16#event#quiz_completed', 1),
  agg('2026-08-15#page#/', 2),
  agg('2026-08-16#page#/subjects/math', 3),
  agg('2026-08-15#referrer#google.com', 1),
  agg('2026-08-15#host#octavlearning.com', 2),
  agg('2026-08-16#host#octavlearning.com', 3),
  agg('2026-08-16#host#dev.octavlearning.com', 1),
  agg('2026-08-14#event#page_view', 99), // outside the window → dropped
  agg('2026-08-17#event#page_view', 99), // outside the window → dropped
];

const OPTS = { fromDate: '2026-08-15', toDate: '2026-08-16', host: 'octavlearning.com', nowMs: NOW_MS };

describe('buildReport', () => {
  it('folds totals, pages, referrers and hosts, dropping out-of-window rows', () => {
    const data = buildReport(ROWS, OPTS);
    expect(data.totals).toEqual({ page_view: 5, quiz_completed: 1 }); // 99s dropped
    expect(data.topPages).toEqual([
      { path: '/subjects/math', count: 3 },
      { path: '/', count: 2 },
    ]);
    expect(data.topReferrers).toEqual([{ referrer: 'google.com', count: 1 }]);
    expect(data.hosts).toEqual({ 'octavlearning.com': 5, 'dev.octavlearning.com': 1 });
    expect(data.generatedAt).toBe('2026-08-16T12:00:00.000Z');
  });

  it('computes the prod headline from the host aggregates', () => {
    const data = buildReport(ROWS, OPTS);
    expect(data.prodEvents).toBe(5); // octavlearning.com rows summed
    expect(data.totalEvents).toBe(6); // all host rows summed
  });

  it('caps top pages at the configured limit (default 10)', () => {
    const rows = Array.from({ length: 15 }, (_, i) => agg(`2026-08-16#page#/p${i}`, 15 - i));
    const data = buildReport(rows, OPTS);
    expect(data.topPages).toHaveLength(10);
    expect(ANALYTICS_REPORT_TOP_PAGES).toBe(10);
    expect(data.topPages[0]).toEqual({ path: '/p0', count: 15 });
    expect(data.topPages[9]).toEqual({ path: '/p9', count: 6 });
  });

  it('respects an explicit topPages/topReferrers limit', () => {
    const data = buildReport(ROWS, { ...OPTS, topPages: 1, topReferrers: 1 });
    expect(data.topPages).toEqual([{ path: '/subjects/math', count: 3 }]);
    expect(data.topReferrers).toEqual([{ referrer: 'google.com', count: 1 }]);
  });

  it('renders an empty report for no aggregates', () => {
    const data = buildReport([], OPTS);
    expect(data.totals).toEqual({});
    expect(data.topPages).toEqual([]);
    expect(data.topReferrers).toEqual([]);
    expect(data.hosts).toEqual({});
    expect(data.prodEvents).toBe(0);
    expect(data.totalEvents).toBe(0);
  });

  it('orders ties deterministically (count desc, then key asc)', () => {
    const rows = [
      agg('2026-08-16#event#auth_logout', 1),
      agg('2026-08-16#event#auth_login_completed', 1),
      agg('2026-08-16#event#page_view', 1),
    ];
    const data = buildReport(rows, OPTS);
    expect(Object.keys(data.totals)).toEqual(['auth_login_completed', 'auth_logout', 'page_view']);
  });
});
