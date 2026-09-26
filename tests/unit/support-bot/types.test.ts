import { describe, it, expect } from 'vitest';
import type { Alert } from '@/lib/support-bot/types';
import {
  ALERT_BODY_MAX,
  ALERT_SEVERITIES,
  ALERT_SOURCES,
  ALERT_STATUSES,
  ALERT_TITLE_MAX,
  ANALYTICS_ANOMALY_KINDS,
  SUPPORT_ALERT_TTL_DAYS,
  analyticsDedupKey,
  contactDedupKey,
  supportAlertTtl,
  truncateAlertBody,
  truncateAlertTitle,
} from '@/lib/support-bot/types';

// types.ts — constants + pure helpers (docs/support-bot-plan.md §4).

const T0 = Date.parse('2026-09-26T12:00:00.000Z');

describe('support-bot types + constants', () => {
  it('declares the §4 enums', () => {
    expect(ALERT_SEVERITIES).toEqual(['critical', 'high', 'medium', 'low']);
    expect(ALERT_STATUSES).toEqual(['open', 'acknowledged', 'resolved', 'muted']);
    expect(ALERT_SOURCES).toEqual(['contact', 'analytics', 'cloudwatch', 'email']);
    expect(ANALYTICS_ANOMALY_KINDS).toEqual([
      'error_spike',
      'traffic_drop',
      'ai_quota_exhaustion',
      'zero_events',
    ]);
  });

  it('declares the §4 column budgets and the 90-day TTL (§9 Q5)', () => {
    expect(ALERT_TITLE_MAX).toBe(200);
    expect(ALERT_BODY_MAX).toBe(4000);
    expect(SUPPORT_ALERT_TTL_DAYS).toBe(90);
  });

  it('contactDedupKey is one-alert-per-message-ever', () => {
    expect(contactDedupKey('abc-123')).toBe('contact:abc-123');
  });

  it('analyticsDedupKey is day-bucketed on the SUBJECT day (not the poll hour)', () => {
    // Deviation from §4's hour bucket, forced by day-keyed aggregates — the
    // types.ts header note records it.
    expect(analyticsDedupKey('traffic_drop', '2026-09-25')).toBe('analytics:traffic_drop:2026-09-25');
  });

  it('supportAlertTtl is now + 90 days in epoch seconds', () => {
    expect(supportAlertTtl(T0)).toBe(Math.floor(T0 / 1000) + 90 * 86_400);
  });

  it('truncateAlertTitle/Body clamp to the budgets with an ellipsis', () => {
    const longTitle = 't'.repeat(ALERT_TITLE_MAX + 50);
    const longBody = 'b'.repeat(ALERT_BODY_MAX + 50);
    const title = truncateAlertTitle(longTitle);
    const body = truncateAlertBody(longBody);
    expect(title.length).toBe(ALERT_TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
    expect(body.length).toBe(ALERT_BODY_MAX);
    expect(body.endsWith('…')).toBe(true);
    // Short strings pass through untouched.
    expect(truncateAlertTitle('short')).toBe('short');
    expect(truncateAlertBody('short')).toBe('short');
  });

  it('Alert is structurally the §4 schema (compile-time shape + a runtime sample)', () => {
    const alert: Alert = {
      alertId: 'contact:m1',
      source: 'contact',
      sourceRef: 'm1',
      severity: 'high',
      title: 'Bug report from Ada',
      body: 'User reported bug: …',
      status: 'open',
      createdAt: new Date(T0).toISOString(),
      updatedAt: new Date(T0).toISOString(),
      resolvedAt: null,
      dedupKey: 'contact:m1',
      expiresAt: supportAlertTtl(T0),
    };
    expect(alert.alertId).toBe(alert.dedupKey); // the deterministic-PK dedup design
  });
});
