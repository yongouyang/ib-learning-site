import { describe, it, expect } from 'vitest';
import { renderReportHtml, renderReportText } from '@/lib/analytics-report/html';
import { buildOpenAlertsSummary, buildReport } from '@/lib/analytics-report/types';
import type { AnalyticsAggregateItem } from '@/lib/analytics/types';
import type { Alert } from '@/lib/support-bot/types';

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

// --- S6: Open Alerts section (docs/support-bot-plan.md §9 Q9) ---------------

function alertRow(
  overrides: Partial<Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'>> = {}
): Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'> {
  return {
    severity: 'medium',
    title: 'Something happened',
    status: 'open',
    createdAt: '2026-08-16T11:00:00.000Z',
    ...overrides,
  };
}

const ALERTS = buildOpenAlertsSummary(
  [
    alertRow({ severity: 'critical', title: 'Error-rate spike on /api/feedback', createdAt: '2026-08-16T11:30:00.000Z' }),
    alertRow({ severity: 'high', title: 'Traffic drop vs 7-day avg', status: 'acknowledged', createdAt: '2026-08-16T09:00:00.000Z' }),
    alertRow({ severity: 'low', title: 'Feature request: dark mode for print', createdAt: '2026-08-15T20:00:00.000Z' }),
    alertRow({ severity: 'low', title: 'Fourth alert — below the top 3', createdAt: '2026-08-15T10:00:00.000Z' }),
  ],
  { nowMs: NOW_MS }
);

describe('renderReportHtml — Open alerts section (S6)', () => {
  it('renders the counts by severity and the top 3 newest unresolved alerts', () => {
    const html = renderReportHtml(data(ROWS), 'octavlearning.com', ALERTS);
    expect(html).toContain('Open alerts');
    expect(html).toContain('4 unresolved');
    expect(html).toContain('>1 critical<');
    expect(html).toContain('>1 high<');
    expect(html).toContain('>2 low<');
    expect(html).toContain('Error-rate spike on /api/feedback');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('30m old');
    expect(html).toContain('3h old');
    expect(html).toContain('16h old');
    // top-3 truncation: the 26h-old fourth alert counts but is not listed
    expect(html).not.toContain('Fourth alert');
  });

  it('escapes hostile alert titles', () => {
    const hostile = buildOpenAlertsSummary(
      [alertRow({ title: '<script>alert("x")</script> & "quotes"' })],
      { nowMs: NOW_MS }
    );
    const html = renderReportHtml(data(ROWS), 'octavlearning.com', hostile);
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;');
  });

  it('renders the all-clear line when there are no unresolved alerts', () => {
    const none = buildOpenAlertsSummary([], { nowMs: NOW_MS });
    const html = renderReportHtml(data(ROWS), 'octavlearning.com', none);
    expect(html).toContain('Open alerts');
    expect(html).toContain('No unresolved alerts.');
  });

  it('omits the section entirely when the feature is not wired (alerts undefined)', () => {
    const html = renderReportHtml(data(ROWS), 'octavlearning.com');
    expect(html).not.toContain('Open alerts');
  });
});

describe('renderReportText — Open alerts section (S6)', () => {
  it('renders the counts and top 3 in the plain-text fallback', () => {
    const text = renderReportText(data(ROWS), 'octavlearning.com', ALERTS);
    expect(text).toContain('Open alerts:');
    expect(text).toContain('4 unresolved · 1 critical · 1 high · 2 low');
    expect(text).toContain('- [CRITICAL] Error-rate spike on /api/feedback (30m old)');
    expect(text).not.toContain('Fourth alert');
  });

  it('omits the section when alerts is undefined and shows the all-clear when empty', () => {
    expect(renderReportText(data(ROWS), 'octavlearning.com')).not.toContain('Open alerts');
    expect(renderReportText(data(ROWS), 'octavlearning.com', buildOpenAlertsSummary([], { nowMs: NOW_MS }))).toContain(
      'No unresolved alerts.'
    );
  });
});
