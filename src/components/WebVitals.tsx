'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { trackEvent } from '@/lib/analytics';
import { PAGE_PERFORMANCE_METRICS, type PagePerformanceMetric } from '@/lib/analytics/performance';

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  if (!PAGE_PERFORMANCE_METRICS.includes(metric.name as PagePerformanceMetric)) return;
  try {
    if (new URL(metric.navigationURL).pathname.startsWith('/admin')) return;
  } catch {
    return;
  }
  trackEvent('page_performance', {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
  }, { url: metric.navigationURL });
};

export function WebVitals() {
  useReportWebVitals(reportWebVitals);
  return null;
}
