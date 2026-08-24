import { describe, it, expect } from 'vitest';
import { renderReportHtml, renderReportText } from '@/lib/analytics-report/html';
import { buildReport } from '@/lib/analytics-report/types';
import type { AnalyticsAggregateItem } from '@/lib/analytics/types';

const NOW_MS = Date.parse('2026-08-16T12:00:00.000Z');

function data(rows: Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>) {
  return buildReport(rows, { fromDate: '2026-08-15', toDate: '2026-08-16', host: 'octavlearning.com', nowMs: NOW_MS });
}

const ROWS = [
  { s: '2026-08-16#event#page_view', count: 3 },
  { s: '2026-08-16#event#auth_login_completed', count: 1 },
  { s: '2026-08-16#event#paper_marked_with_ai', count: 2 },
  { s: '2026-08-16#page#/subjects/math', count: 3 },
  { s: '2026-08-16#referrer#google.com', count: 1 },
  { s: '2026-08-16#host#octavlearning.com', count: 5 },
  { s: '2026-08-16#host#dev.octavlearning.com', count: 1 },
];

describe('renderReportHtml', () => {
  it('renders the header, headline cards and section titles', () => {
    const html = renderReportHtml(data(ROWS), 'octavlearning.com');
    expect(html).toContain('Octav Analytics');
    expect(html).toContain('2026-08-16');
    expect(html).toContain('Page views');
    expect(html).toContain('>3<'); // page_view headline
    expect(html).toContain('Sign-ins');
    expect(html).toContain('Papers marked with AI');
    expect(html).toContain('Events');
    expect(html).toContain('Top pages');
    expect(html).toContain('/subjects/math');
    expect(html).toContain('Top referrers');
    expect(html).toContain('google.com');
    expect(html).toContain('Traffic split');
    expect(html).toContain('Prod (octavlearning.com): <strong style="color:#111827;">5</strong> events · 83% of traffic');
  });

  it('escapes client-controlled strings (paths, referrers, hosts)', () => {
    const rows = [
      { s: '2026-08-16#page#/<script>alert(1)</script>', count: 1 },
      { s: '2026-08-16#referrer#evil&<b>', count: 1 },
      { s: '2026-08-16#host#"><img src=x>', count: 1 },
    ];
    const html = renderReportHtml(data(rows), 'octavlearning.com');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('evil&amp;&lt;b&gt;');
    expect(html).toContain('&quot;&gt;&lt;img src=x&gt;');
  });

  it('renders empty-state sections when there is no data', () => {
    const html = renderReportHtml(data([]), 'octavlearning.com');
    expect(html).toContain('No data in this window.');
    expect(html).toContain('>0<'); // headline zeros
  });
});

describe('renderReportText', () => {
  it('renders a plain-text summary with the same numbers', () => {
    const text = renderReportText(data(ROWS), 'octavlearning.com');
    expect(text).toContain('Octav Analytics — 2026-08-16');
    expect(text).toContain('Page views: 3');
    expect(text).toContain('Papers marked with AI: 2');
    expect(text).toContain('Prod events (octavlearning.com, 83% of traffic): 5');
    expect(text).toContain('/subjects/math: 3');
    expect(text).toContain('google.com: 1');
  });
});
