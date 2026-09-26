import type { Alert, AlertSeverity } from './types';

// Alert email rendering (plan §6.1): inline-styled light theme (email clients
// strip <style> blocks), no external assets, plain-text fallback included.
// EVERY dynamic value is HTML-escaped — title/body/sourceRef derive from
// user-controlled contact messages, never trusted (the analytics-report
// html.ts pattern).
//
// Deviation (recorded): §6.1 asks for a link to /admin/dynamodb "with the
// query pre-filled for the alertId" — the admin page is client-state only (no
// searchParams support), so the email links to the page and prints the
// alertId + table name for manual lookup instead.

const ADMIN_URL = 'https://octavlearning.com/admin/dynamodb';
const ALERTS_TABLE = 'octav-support-alerts';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SEVERITY_COLOURS: Record<AlertSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
};

/** §6.1 subject format: `[Octav Alert] [{SEVERITY}] {title}`. */
export function alertSubject(alert: Alert): string {
  return `[Octav Alert] [${alert.severity.toUpperCase()}] ${alert.title}`;
}

/** Meta row — a label/value pair with a bottom border. Both sides escaped. */
function metaRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${esc(label)}</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;word-break:break-all;">${esc(value)}</td></tr>`;
}

/** Full HTML document for the alert email (inline styles only). */
export function renderAlertHtml(alert: Alert): string {
  const colour = SEVERITY_COLOURS[alert.severity];
  const severityLabel = alert.severity.toUpperCase();
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${colour};color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.05em;">OCTAV ALERT · ${esc(severityLabel)}</h1>
        <p style="margin:6px 0 0;font-size:17px;font-weight:700;">${esc(alert.title)}</p>
      </div>
      <div style="padding:24px;">
        <div style="margin-bottom:24px;background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:16px;">
          <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;word-break:break-word;">${esc(alert.body)}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
          ${metaRow('Severity', severityLabel)}
          ${metaRow('Source', alert.source)}
          ${metaRow('Source ref', alert.sourceRef)}
          ${metaRow('Alert ID', alert.alertId)}
          ${metaRow('Raised at', alert.createdAt)}
        </table>
        <a href="${ADMIN_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">Open the admin DynamoDB browser</a>
        <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Table <strong>${ALERTS_TABLE}</strong> · hash key <strong>alertId</strong> = ${esc(alert.alertId)}</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">
        Sent automatically by the Octav Learning support bot · alerts persist in ${ALERTS_TABLE} for 90 days even when this email fails
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Plain-text fallback for clients that refuse HTML. */
export function renderAlertText(alert: Alert): string {
  return [
    `[Octav Alert] [${alert.severity.toUpperCase()}] ${alert.title}`,
    '',
    alert.body,
    '',
    `Severity: ${alert.severity}`,
    `Source: ${alert.source}`,
    `Source ref: ${alert.sourceRef}`,
    `Alert ID: ${alert.alertId}`,
    `Raised at: ${alert.createdAt}`,
    '',
    `Review: ${ADMIN_URL} (table ${ALERTS_TABLE}, hash key alertId)`,
    '',
    'Sent automatically by the Octav Learning support bot.',
  ].join('\n');
}
