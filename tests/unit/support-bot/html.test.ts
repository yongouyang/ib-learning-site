import { describe, it, expect } from 'vitest';
import { alertSubject, renderAlertHtml, renderAlertText } from '@/lib/support-bot/html';
import type { Alert } from '@/lib/support-bot/types';

// Alert email template (plan §6.1): inline-styled HTML + plain-text fallback,
// every user-controlled value escaped, link to the admin DynamoDB browser.

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    alertId: 'contact:m1',
    source: 'contact',
    sourceRef: 'm1',
    severity: 'high',
    title: 'Bug report from Ada',
    body: 'User reported bug: the quiz crashed. Check /admin/dynamodb → octav-contact → messageId=m1.',
    status: 'open',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    resolvedAt: null,
    dedupKey: 'contact:m1',
    expiresAt: 0,
    ...overrides,
  };
}

describe('alertSubject', () => {
  it('is the §6.1 format: [Octav Alert] [{SEVERITY}] {title}', () => {
    expect(alertSubject(alert())).toBe('[Octav Alert] [HIGH] Bug report from Ada');
    expect(alertSubject(alert({ severity: 'low', title: 'Feature request' }))).toBe('[Octav Alert] [LOW] Feature request');
  });
});

describe('renderAlertHtml', () => {
  it('renders the title, body, metadata and the admin link', () => {
    const html = renderAlertHtml(alert());
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Bug report from Ada');
    expect(html).toContain('User reported bug: the quiz crashed.');
    expect(html).toContain('OCTAV ALERT · HIGH');
    expect(html).toContain('contact:m1'); // alertId
    expect(html).toContain('2026-09-26T12:00:00.000Z');
    expect(html).toContain('https://octavlearning.com/admin/dynamodb');
    expect(html).toContain('octav-support-alerts');
    // Inline styles only — no <style> block, no external assets.
    expect(html).not.toContain('<style');
    expect(html).not.toContain('http://');
  });

  it('escapes every user-controlled value (contact name/message land in title+body)', () => {
    const hostile = alert({
      title: '<script>alert("x")</script>',
      body: '<img src=x onerror="alert(1)"> & "quoted" \'apostrophe\'',
      sourceRef: '"><script>',
      alertId: 'contact:<b>bold</b>',
    });
    const html = renderAlertHtml(hostile);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;quoted&quot; &#39;apostrophe&#39;');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('contact:&lt;b&gt;bold&lt;/b&gt;');
  });

  it('colours the header by severity', () => {
    expect(renderAlertHtml(alert({ severity: 'critical' }))).toContain('background:#dc2626');
    expect(renderAlertHtml(alert({ severity: 'high' }))).toContain('background:#ea580c');
    expect(renderAlertHtml(alert({ severity: 'medium' }))).toContain('background:#d97706');
    expect(renderAlertHtml(alert({ severity: 'low' }))).toContain('background:#2563eb');
  });
});

describe('renderAlertText', () => {
  it('renders the plain-text fallback with the subject line, body, metadata and review pointer', () => {
    const text = renderAlertText(alert());
    const lines = text.split('\n');
    expect(lines[0]).toBe('[Octav Alert] [HIGH] Bug report from Ada');
    expect(text).toContain('User reported bug: the quiz crashed.');
    expect(text).toContain('Source ref: m1');
    expect(text).toContain('Alert ID: contact:m1');
    expect(text).toContain('https://octavlearning.com/admin/dynamodb');
  });

  it('keeps user-controlled values raw (plain text needs no escaping)', () => {
    const text = renderAlertText(alert({ body: '<b>not bold in text</b>' }));
    expect(text).toContain('<b>not bold in text</b>');
  });
});
