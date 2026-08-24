import { ANALYTICS_REPORT_EVENT_LABELS, type AnalyticsReportData } from './types';

// HTML + plain-text rendering for the daily analytics email. Inline-styled
// light theme (email clients strip <style> blocks), no external assets.
// EVERY dynamic value is HTML-escaped — paths/referrers/hosts are
// client-reported strings, never trusted.

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const cardTitle = (label: string): string =>
  `<h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">${label}</h2>`;

const empty = '<p style="margin:0;font-size:13px;color:#6b7280;">No data in this window.</p>';

/** Section row — a label/value pair with a top border. Both sides escaped. */
function tableRow(label: string, value: string | number, strong = false): string {
  const valueStyle = strong
    ? 'font-size:14px;font-weight:700;color:#111827;'
    : 'font-size:14px;color:#374151;';
  return `<tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${esc(label)}</td><td style="padding:8px 0;text-align:right;${valueStyle}border-bottom:1px solid #f3f4f6;">${esc(String(value))}</td></tr>`;
}

/** The headline stat cards (mirrors the dashboard's two big counters). */
function headlineCards(data: AnalyticsReportData): string {
  const cards = [
    { label: 'Page views', value: data.totals.page_view ?? 0 },
    { label: 'Sign-ins', value: data.totals.auth_login_completed ?? 0 },
    { label: 'Papers marked with AI', value: data.totals.paper_marked_with_ai ?? 0 },
    { label: 'Events (all types)', value: Object.values(data.totals).reduce((a, b) => a + b, 0) },
  ];
  const cell = (label: string, value: number) =>
    `<td style="width:25%;padding:12px;text-align:center;background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;"><div style="font-size:22px;font-weight:800;color:#111827;">${value}</div><div style="margin-top:2px;font-size:11px;color:#6b7280;">${label}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>${cards.map((c) => cell(c.label, c.value)).join('')}</tr></table>`;
}

function eventsTable(data: AnalyticsReportData): string {
  const rows = Object.entries(data.totals).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return empty;
  const body = rows
    .map(([name, count]) => tableRow(ANALYTICS_REPORT_EVENT_LABELS[name] ?? name, count))
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${body}</table>`;
}

function listRows(items: Array<{ key: string; count: number }>): string {
  if (items.length === 0) return empty;
  const body = items.map(({ key, count }) => tableRow(key, count)).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${body}</table>`;
}

function trafficSplit(data: AnalyticsReportData, host: string): string {
  const hosts = Object.entries(data.hosts).sort((a, b) => b[1] - a[1]);
  if (hosts.length === 0) return empty;
  const body = hosts
    .map(([h, count]) => tableRow(h === '' ? '(unknown)' : h, count))
    .join('');
  const prodPct = data.totalEvents > 0 ? Math.round((data.prodEvents / data.totalEvents) * 100) : 0;
  const headline = `<p style="margin:0 0 12px;font-size:13px;color:#374151;">Prod (${esc(host)}): <strong style="color:#111827;">${data.prodEvents}</strong> events · ${prodPct}% of traffic</p>`;
  return `${headline}<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${body}</table>`;
}

/** Full HTML document for the email (inline styles only). `host` is the
 * prod hostname highlighted in the traffic split (deps.host). */
export function renderReportHtml(data: AnalyticsReportData, host: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#2563eb;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;font-weight:700;">Octav Analytics</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${esc(data.toDate)} · last 24h (daily aggregates) · all traffic</p>
      </div>
      <div style="padding:24px;">
        ${headlineCards(data)}
        <div style="margin-bottom:24px;">${cardTitle('Events')}${eventsTable(data)}</div>
        <div style="margin-bottom:24px;">${cardTitle('Top pages')}${listRows(data.topPages.map((p) => ({ key: p.path, count: p.count })))}</div>
        <div style="margin-bottom:24px;">${cardTitle('Top referrers')}${listRows(data.topReferrers.map((r) => ({ key: r.referrer, count: r.count })))}</div>
        <div>${cardTitle('Traffic split')}${trafficSplit(data, host)}</div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">
        Sent automatically by Octav Learning · <a href="https://octavlearning.com" style="color:#2563eb;text-decoration:none;">octavlearning.com</a> · daily at 7pm HKT
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Plain-text fallback for clients that refuse HTML. `host` is the prod
 * hostname highlighted in the traffic split (deps.host). */
export function renderReportText(data: AnalyticsReportData, host: string): string {
  const lines: string[] = [
    `Octav Analytics — ${data.toDate} (last 24h, daily aggregates)`,
    '',
    `Page views: ${data.totals.page_view ?? 0}`,
    `Sign-ins: ${data.totals.auth_login_completed ?? 0}`,
    `Papers marked with AI: ${data.totals.paper_marked_with_ai ?? 0}`,
    `Events (all types): ${Object.values(data.totals).reduce((a, b) => a + b, 0)}`,
    `Prod events (${host}, ${data.totalEvents > 0 ? Math.round((data.prodEvents / data.totalEvents) * 100) : 0}% of traffic): ${data.prodEvents}`,
    '',
    'Events:',
    ...Object.entries(data.totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `  ${ANALYTICS_REPORT_EVENT_LABELS[name] ?? name}: ${count}`),
    '',
    'Top pages:',
    ...data.topPages.map((p) => `  ${p.path}: ${p.count}`),
    '',
    'Top referrers:',
    ...data.topReferrers.map((r) => `  ${r.referrer}: ${r.count}`),
    '',
    'Traffic split:',
    ...Object.entries(data.hosts)
      .sort((a, b) => b[1] - a[1])
      .map(([host, count]) => `  ${host || '(unknown)'}: ${count}`),
    '',
    'Sent automatically by Octav Learning · octavlearning.com · daily at 7pm HKT',
  ];
  return lines.join('\n');
}
