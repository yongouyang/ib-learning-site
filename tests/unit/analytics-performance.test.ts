import { describe, expect, it } from 'vitest';
import { buildPerformanceReport, type PagePerformanceEvent } from '@/lib/analytics/performance';

function event(metric: string, value: number, overrides: {
  path?: string;
  rating?: string;
  navigationType?: string;
  name?: string;
} = {}): PagePerformanceEvent {
  return {
    name: overrides.name ?? 'page_performance',
    urlPath: overrides.path ?? '/subjects/math',
    props: {
      metric,
      value,
      rating: overrides.rating ?? 'good',
      navigationType: overrides.navigationType ?? 'navigate',
    },
  };
}

describe('page performance report', () => {
  it('computes nearest-rank percentiles and rating counts per metric', () => {
    const report = buildPerformanceReport([
      event('LCP', 100),
      event('LCP', 200),
      event('LCP', 300, { rating: 'needs-improvement' }),
      event('LCP', 400, { rating: 'poor' }),
      event('TTFB', 80),
      event('CLS', 0.12345),
    ]);

    expect(report.samples).toBe(6);
    expect(report.byMetric.LCP).toEqual({
      count: 4, p50: 200, p75: 300, p95: 400, good: 2, needsImprovement: 1, poor: 1,
    });
    expect(report.byMetric.TTFB).toMatchObject({ count: 1, p75: 80 });
    expect(report.byMetric.CLS).toMatchObject({ count: 1, p75: 0.123 });
    expect(report.units).toEqual({ TTFB: 'ms', FCP: 'ms', LCP: 'ms', CLS: 'score', INP: 'ms' });
  });

  it('separates navigation types and ranks paths by p75 LCP', () => {
    const report = buildPerformanceReport([
      event('LCP', 1800, { path: '/slow' }),
      event('LCP', 900, { path: '/fast' }),
      event('LCP', 700, { path: '/slow', navigationType: 'soft-navigation' }),
      event('FCP', 500, { path: '/fast' }),
    ]);

    expect(Object.keys(report.byPath)).toEqual(['/slow', '/fast']);
    expect(report.byPath['/slow'].LCP).toMatchObject({ count: 2, p75: 1800 });
    expect(report.byNavigation.navigate.LCP).toMatchObject({ count: 2, p75: 1800 });
    expect(report.byNavigation['soft-navigation'].LCP).toMatchObject({ count: 1, p75: 700 });
  });

  it('honours the path limit and ignores unrelated or malformed events', () => {
    const malformed = event('LCP', 10);
    malformed.props.value = 'not-a-number';
    const report = buildPerformanceReport([
      malformed,
      event('LCP', 10, { name: 'page_view' }),
      event('UNKNOWN', 10),
      event('LCP', 100, { path: '/a' }),
      event('LCP', 200, { path: '/b' }),
    ], 1);

    expect(report.samples).toBe(2);
    expect(Object.keys(report.byPath)).toEqual(['/b']);
    expect(buildPerformanceReport([])).toMatchObject({ samples: 0, byMetric: {}, byNavigation: {}, byPath: {} });
  });
});
