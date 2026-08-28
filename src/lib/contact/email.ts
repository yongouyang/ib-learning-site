import type { ContactMessage, ContactSubject } from './types';

// HTML + plain-text rendering for the contact-notification email (Feature 3).
// Inline-styled light theme (email clients strip <style> blocks), no external
// assets — the analytics-report/html.ts pattern. EVERY user-controlled value
// (name/email/message) is HTML-escaped before interpolation; the subject line
// additionally strips CR/LF (the 100-char name may contain newlines, which
// must never reach a header-shaped string).

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SUBJECT_LABELS: Record<ContactSubject, string> = {
  bug_report: 'Bug report',
  feature_request: 'Feature request',
  question: 'Question',
  other: 'Other',
};

/** One-line subject; CR/LF stripped from the user-provided name. */
export function contactEmailSubject(message: ContactMessage): string {
  const name = message.name.replace(/[\r\n]+/g, ' ');
  return `Octav contact: ${SUBJECT_LABELS[message.subject]} from ${name}`;
}

function tableRow(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${esc(label)}</td><td style="padding:8px 0;text-align:right;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${esc(value)}</td></tr>`;
}

/** Full HTML document for the notification email (inline styles only). */
export function renderContactEmailHtml(message: ContactMessage): string {
  const rows = [
    tableRow('From', message.name),
    tableRow('Email', message.email),
    tableRow('Subject', SUBJECT_LABELS[message.subject]),
    tableRow('Signed-in user', message.userId ?? '(anonymous)'),
    tableRow('Received', message.createdAt),
    tableRow('Message ID', message.messageId),
  ].join('');
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#2563eb;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;font-weight:700;">Octav contact</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${esc(SUBJECT_LABELS[message.subject])} · ${esc(message.createdAt)}</p>
      </div>
      <div style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">${rows}</table>
        <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">Message</h2>
        <div style="padding:16px;background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;font-size:14px;color:#111827;white-space:pre-wrap;">${esc(message.message)}</div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">
        Sent by the Octav Learning contact form · reply directly to the sender's address above
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Plain-text fallback for clients that refuse HTML. */
export function renderContactEmailText(message: ContactMessage): string {
  return [
    `Octav contact: ${SUBJECT_LABELS[message.subject]}`,
    '',
    `From: ${message.name}`,
    `Email: ${message.email}`,
    `Signed-in user: ${message.userId ?? '(anonymous)'}`,
    `Received: ${message.createdAt}`,
    `Message ID: ${message.messageId}`,
    '',
    'Message:',
    message.message,
    '',
    '— Sent by the Octav Learning contact form',
  ].join('\n');
}
