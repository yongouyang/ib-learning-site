export const PAGE_PERFORMANCE_METRICS = ['TTFB', 'FCP', 'LCP', 'CLS', 'INP'] as const;
export const PAGE_PERFORMANCE_NAVIGATION_TYPES = [
  'navigate',
  'reload',
  'prerender',
  'back-forward',
  'back-forward-cache',
  'restore',
  'soft-navigation',
] as const;

export type PagePerformanceMetric = (typeof PAGE_PERFORMANCE_METRICS)[number];

export interface PagePerformanceEvent {
  name: string;
  props: Record<string, unknown>;
  urlPath: string;
}

export interface PagePerformanceStats {
  count: number;
  p50: number;
  p75: number;
  p95: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

type MetricStats = Partial<Record<PagePerformanceMetric, PagePerformanceStats>>;

export interface PagePerformanceReport {
  samples: number;
  units: Record<PagePerformanceMetric, 'ms' | 'score'>;
  byMetric: MetricStats;
  byNavigation: Record<string, MetricStats>;
  byPath: Record<string, MetricStats>;
}

interface Sample {
  metric: PagePerformanceMetric;
  value: number;
  rating: string;
  navigationType: string;
  path: string;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function rounded(metric: PagePerformanceMetric, value: number): number {
  return metric === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value);
}

function summarise(samples: Sample[]): PagePerformanceStats | undefined {
  if (samples.length === 0) return undefined;
  const metric = samples[0].metric;
  const values = samples.map((sample) => sample.value);
  return {
    count: samples.length,
    p50: rounded(metric, percentile(values, 0.5)),
    p75: rounded(metric, percentile(values, 0.75)),
    p95: rounded(metric, percentile(values, 0.95)),
    good: samples.filter((sample) => sample.rating === 'good').length,
    needsImprovement: samples.filter((sample) => sample.rating === 'needs-improvement').length,
    poor: samples.filter((sample) => sample.rating === 'poor').length,
  };
}

function addMetric(target: MetricStats, samples: Sample[]): void {
  for (const metric of PAGE_PERFORMANCE_METRICS) {
    const stats = summarise(samples.filter((sample) => sample.metric === metric));
    if (stats) target[metric] = stats;
  }
}

export function buildPerformanceReport(events: PagePerformanceEvent[], pathLimit = 20): PagePerformanceReport {
  const samples: Sample[] = [];
  for (const event of events) {
    if (event.name !== 'page_performance') continue;
    const { metric, value, rating, navigationType } = event.props;
    if (
      !PAGE_PERFORMANCE_METRICS.includes(metric as PagePerformanceMetric) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      typeof rating !== 'string' ||
      typeof navigationType !== 'string'
    ) continue;
    samples.push({ metric: metric as PagePerformanceMetric, value, rating, navigationType, path: event.urlPath });
  }

  const report: PagePerformanceReport = {
    samples: samples.length,
    units: { TTFB: 'ms', FCP: 'ms', LCP: 'ms', CLS: 'score', INP: 'ms' },
    byMetric: {},
    byNavigation: {},
    byPath: {},
  };
  addMetric(report.byMetric, samples);

  const navigations = [...new Set(samples.map((sample) => sample.navigationType))].sort();
  for (const navigation of navigations) {
    const target: MetricStats = {};
    addMetric(target, samples.filter((sample) => sample.navigationType === navigation));
    report.byNavigation[navigation] = target;
  }

  const paths = [...new Set(samples.map((sample) => sample.path))]
    .sort((a, b) => {
      const aLcp = summarise(samples.filter((sample) => sample.path === a && sample.metric === 'LCP'))?.p75 ?? -1;
      const bLcp = summarise(samples.filter((sample) => sample.path === b && sample.metric === 'LCP'))?.p75 ?? -1;
      return bLcp - aLcp || a.localeCompare(b);
    })
    .slice(0, pathLimit);
  for (const path of paths) {
    const target: MetricStats = {};
    addMetric(target, samples.filter((sample) => sample.path === path));
    report.byPath[path] = target;
  }
  return report;
}
