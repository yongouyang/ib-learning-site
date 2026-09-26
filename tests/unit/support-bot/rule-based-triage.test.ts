import { describe, it, expect } from 'vitest';
import type { ContactMessage } from '@/lib/contact/types';
import { RuleBasedTriageProvider, ruleBasedTriage } from '@/lib/support-bot/triage/rule-based';
import type { AnalyticsAnomalyKind, AnalyticsAnomalySignal, ContactSignal } from '@/lib/support-bot/types';
import { ALERT_BODY_MAX, ALERT_TITLE_MAX } from '@/lib/support-bot/types';

// Rule-based triage (plan §3.1/§3.2/§5.1): every signal kind maps to the
// tabled severity, and the templates carry the tabled content.

function contactSignal(subject: ContactMessage['subject'], overrides: Partial<ContactMessage> = {}): ContactSignal {
  const message: ContactMessage = {
    messageId: 'm1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    subject,
    message: 'The quiz crashed when I pressed submit.',
    userId: null,
    createdAt: '2026-09-25T10:00:00.000Z',
    status: 'new',
    expiresAt: 0,
    ...overrides,
  };
  return { source: 'contact', kind: 'contact_message', dedupKey: `contact:${message.messageId}`, sourceRef: message.messageId, message };
}

function anomaly(kind: AnalyticsAnomalyKind, overrides: Partial<AnalyticsAnomalySignal> = {}): AnalyticsAnomalySignal {
  return {
    source: 'analytics',
    kind,
    dedupKey: `analytics:${kind}:2026-09-25`,
    sourceRef: 'agg:2026-09-25',
    subjectDate: '2026-09-25',
    count: 20,
    baseline: 5,
    ...overrides,
  };
}

describe('ruleBasedTriage — §3.1 contact subjects', () => {
  it('bug_report → HIGH with the messageId pointer', () => {
    const r = ruleBasedTriage(contactSignal('bug_report'));
    expect(r.severity).toBe('high');
    expect(r.title).toBe('Bug report from Ada Lovelace');
    expect(r.body).toContain('User reported bug: The quiz crashed when I pressed submit.');
    expect(r.body).toContain('messageId=m1');
    expect(r.suggestedActions.length).toBeGreaterThan(0);
  });

  it('question → MEDIUM with name + email', () => {
    const r = ruleBasedTriage(contactSignal('question'));
    expect(r.severity).toBe('medium');
    expect(r.title).toBe('Question from Ada Lovelace');
    expect(r.body).toContain('User question from Ada Lovelace (ada@example.com):');
    expect(r.body).toContain('consider FAQ/content update');
  });

  it('feature_request → LOW', () => {
    const r = ruleBasedTriage(contactSignal('feature_request'));
    expect(r.severity).toBe('low');
    expect(r.title).toBe('Feature request from Ada Lovelace');
    expect(r.body).toContain('Review against roadmap; acknowledge receipt.');
  });

  it('other → MEDIUM, manual review', () => {
    const r = ruleBasedTriage(contactSignal('other'));
    expect(r.severity).toBe('medium');
    expect(r.title).toBe('Contact form message from Ada Lovelace');
    expect(r.body).toContain('Manual review needed.');
  });

  it('collapses whitespace in the message summary', () => {
    const r = ruleBasedTriage(contactSignal('question', { message: 'line one\n\n  line   two' }));
    expect(r.body).toContain('line one line two');
  });
});

describe('ruleBasedTriage — §3.2 analytics anomalies', () => {
  it('error_spike → CRITICAL with the spike ratio + baseline', () => {
    const r = ruleBasedTriage(anomaly('error_spike', { count: 20, baseline: 5, context: { topPaths: '/study, /quiz' } }));
    expect(r.severity).toBe('critical');
    expect(r.title).toBe('Error events spiked 4× on 2026-09-25');
    expect(r.body).toContain('4× above baseline on 2026-09-25');
    expect(r.body).toContain('(20 vs 7-day daily avg 5)');
    expect(r.body).toContain('Top affected: /study, /quiz');
    expect(r.body).toContain('CloudWatch');
  });

  it('traffic_drop → HIGH with the drop percentage (event volume, not DAU)', () => {
    const r = ruleBasedTriage(anomaly('traffic_drop', { count: 30, baseline: 100 }));
    expect(r.severity).toBe('high');
    expect(r.title).toBe('Prod traffic down 70% on 2026-09-25');
    expect(r.body).toContain('dropped to 30 events on 2026-09-25 (7-day daily avg: 100)');
    expect(r.body).toContain('PWA service worker breakage');
  });

  it('ai_quota_exhaustion → MEDIUM with the current quotas', () => {
    const r = ruleBasedTriage(anomaly('ai_quota_exhaustion', { count: 7, baseline: 30 }));
    expect(r.severity).toBe('medium');
    expect(r.title).toBe('7 users hit the AI-mark quota on 2026-09-25');
    expect(r.body).toContain('Current: free=30/mo, premium=1000/mo.');
  });

  it('zero_events → HIGH with the health-probe pointer', () => {
    const r = ruleBasedTriage(anomaly('zero_events', { count: 0, baseline: 120 }));
    expect(r.severity).toBe('high');
    expect(r.title).toBe('No prod analytics events on 2026-09-25');
    expect(r.body).toContain('full UTC day 2026-09-25');
    expect(r.body).toContain('/api/analytics/_health');
  });
});

describe('ruleBasedTriage — budgets + provider', () => {
  it('clamps title and body to the §4 budgets no matter the input', () => {
    const r = ruleBasedTriage(
      contactSignal('bug_report', { name: 'N'.repeat(500), message: 'x'.repeat(10_000) })
    );
    expect(r.title.length).toBeLessThanOrEqual(ALERT_TITLE_MAX);
    expect(r.title.endsWith('…')).toBe(true);
    // The message summary is pre-capped (500 chars), so a contact body can
    // never reach the budget — the truncateAlertBody clamp is defence in depth.
    expect(r.body.length).toBeLessThanOrEqual(ALERT_BODY_MAX);
  });

  it('RuleBasedTriageProvider matches the pure function', async () => {
    const provider = new RuleBasedTriageProvider();
    const signal = contactSignal('bug_report');
    expect(await provider.triage(signal)).toEqual(ruleBasedTriage(signal));
  });
});
