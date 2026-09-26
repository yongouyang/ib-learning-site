import { describe, it, expect, vi } from 'vitest';
import type { ContactMessage } from '@/lib/contact/types';
import type { SupportBotDeps } from '@/lib/support-bot/deps';
import { InMemorySupportBotStorage } from '@/lib/support-bot/dummy';
import { buildAlert, contactSignalFromMessage, pollAndAlert } from '@/lib/support-bot/handler';
import { RuleBasedTriageProvider, ruleBasedTriage } from '@/lib/support-bot/triage/rule-based';
import type { Alert, SupportBotStorage } from '@/lib/support-bot/types';
import { contactDedupKey, supportAlertTtl } from '@/lib/support-bot/types';

// The core orchestration loop (plan §7): poll → dedup → triage → conditional
// persist → deliver, with §7/§11 error semantics.

const T0 = Date.parse('2026-09-26T12:00:00.000Z');
const ISO_T0 = new Date(T0).toISOString();
const PROD = 'octavlearning.com';

function message(id: string, overrides: Partial<ContactMessage> = {}): ContactMessage {
  return {
    messageId: id,
    name: 'Ada',
    email: 'ada@example.com',
    subject: 'bug_report',
    message: 'The quiz crashed.',
    userId: null,
    createdAt: '2026-09-25T10:00:00.000Z',
    status: 'new',
    expiresAt: 0,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<SupportBotDeps> = {}) {
  const storage = new InMemorySupportBotStorage(() => T0);
  const deliveries: Alert[] = [];
  const deps: SupportBotDeps = {
    storage,
    triage: new RuleBasedTriageProvider(),
    delivery: { deliver: async (a: Alert) => { deliveries.push(a); } },
    recipients: ['admin@example.com'],
    prodHost: PROD,
    clock: () => T0,
    ...overrides,
  };
  return { deps, storage, deliveries };
}

/** 7-day prod baseline (2026-09-18..24) at 100/day + a subject-day count. */
function trafficAggregates(subjectDayCount: number) {
  const rows = [];
  for (let d = 18; d <= 24; d++) rows.push({ s: `2026-09-${d}#host#${PROD}`, count: 100 });
  rows.push({ s: `2026-09-25#host#${PROD}`, count: subjectDayCount });
  return rows;
}

describe('contactSignalFromMessage / buildAlert', () => {
  it('builds the §4 alert row on the server clock', () => {
    const signal = contactSignalFromMessage(message('m1'));
    expect(signal.dedupKey).toBe('contact:m1');
    expect(signal.sourceRef).toBe('m1');

    const alert = buildAlert(signal, ruleBasedTriage(signal), T0);
    expect(alert).toEqual({
      alertId: 'contact:m1', // deterministic PK (the types.ts dedup design)
      source: 'contact',
      sourceRef: 'm1',
      severity: 'high',
      title: 'Bug report from Ada',
      body: expect.stringContaining('messageId=m1'),
      status: 'open',
      createdAt: ISO_T0,
      updatedAt: ISO_T0,
      resolvedAt: null,
      dedupKey: 'contact:m1',
      expiresAt: supportAlertTtl(T0),
    });
  });
});

describe('pollAndAlert', () => {
  it('creates, persists and delivers one alert per new contact message', async () => {
    const { deps, storage, deliveries } = makeDeps();
    await storage.saveContactMessage(message('m1'));
    await storage.saveContactMessage(message('m2', { subject: 'question' }));

    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({ ok: true, polled: 2, newAlerts: 2, delivered: 2, skipped: 0, errors: 0 });

    const alerts = storage.listAlerts();
    expect(alerts.map((a) => a.alertId).sort()).toEqual(['contact:m1', 'contact:m2']);
    expect(alerts.find((a) => a.alertId === 'contact:m2')?.severity).toBe('medium');
    expect(deliveries.map((a) => a.alertId).sort()).toEqual(['contact:m1', 'contact:m2']);
  });

  it('dedups: a second run over the same message creates NOTHING (§4)', async () => {
    const { deps, storage, deliveries } = makeDeps();
    await storage.saveContactMessage(message('m1'));

    await pollAndAlert(deps);
    const second = await pollAndAlert(deps);
    expect(second).toEqual({ ok: true, polled: 1, newAlerts: 0, delivered: 0, skipped: 1, errors: 0 });
    expect(storage.listAlerts()).toHaveLength(1);
    expect(deliveries).toHaveLength(1);
  });

  it('re-opens when the existing alert was RESOLVED (§11)', async () => {
    const { deps, storage, deliveries } = makeDeps();
    await storage.saveContactMessage(message('m1'));
    await pollAndAlert(deps);

    // The admin resolves the alert via the dashboard (out-of-band write).
    const existing = (await storage.getAlert(contactDedupKey('m1')))!;
    (storage as unknown as { alerts: Map<string, Alert> }).alerts.set(existing.alertId, {
      ...existing,
      status: 'resolved',
      resolvedAt: ISO_T0,
    });

    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({ ok: true, polled: 1, newAlerts: 1, delivered: 1, skipped: 0, errors: 0 });
    const reopened = await storage.getAlert(contactDedupKey('m1'));
    expect(reopened?.status).toBe('open');
    expect(reopened?.resolvedAt).toBeNull();
    expect(deliveries).toHaveLength(2);
  });

  it('raises an analytics anomaly alert from the aggregate rows', async () => {
    const { deps, storage } = makeDeps();
    // Simulate the analytics Lambda having written these aggregates: a >50%
    // prod-traffic drop on the subject day (100/day baseline → 30).
    for (const row of trafficAggregates(30)) {
      // Write through the dummy's aggregate accessor the way recordEvent would.
      (storage as unknown as { aggregates: Map<string, number> }).aggregates.set(row.s, row.count);
    }

    const summary = await pollAndAlert(deps);
    expect(summary.polled).toBe(1);
    expect(summary.newAlerts).toBe(1);
    const alert = await storage.getAlert('analytics:traffic_drop:2026-09-25');
    expect(alert?.severity).toBe('high');
    expect(alert?.source).toBe('analytics');
    expect(alert?.sourceRef).toBe('agg:2026-09-25');

    // And the same anomaly does not re-alert on the next run.
    const second = await pollAndAlert(deps);
    expect(second.skipped).toBe(1);
  });

  it('a quiet period polls nothing and returns ok', async () => {
    const { deps } = makeDeps();
    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({ ok: true, polled: 0, newAlerts: 0, delivered: 0, skipped: 0, errors: 0 });
  });

  it('no recipients configured → ok:false WITHOUT throwing, and nothing is polled or persisted (§11)', async () => {
    const { deps, storage } = makeDeps({ recipients: [] });
    await storage.saveContactMessage(message('m1'));

    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({
      ok: false,
      error: 'no recipients configured (ANALYTICS_ADMIN_EMAILS)',
      polled: 0,
      newAlerts: 0,
      delivered: 0,
      skipped: 0,
      errors: 0,
    });
    // The pending message was NOT alerted — it alerts on the first run after
    // recipients are configured (its dedup key was never written).
    expect(storage.listAlerts()).toHaveLength(0);
    const recovered = await pollAndAlert({ ...deps, recipients: ['admin@example.com'] });
    expect(recovered).toMatchObject({ ok: true, polled: 1, newAlerts: 1, delivered: 1 });
  });

  it('delivery failure never fails the run — the alert stays persisted, the send is NOT retried (§6.1/§11)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let sendAttempts = 0;
    const { deps, storage } = makeDeps({
      delivery: {
        deliver: async () => {
          sendAttempts++;
          throw new Error('resend 500');
        },
      },
    });
    await storage.saveContactMessage(message('m1'));

    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({ ok: true, polled: 1, newAlerts: 1, delivered: 0, skipped: 0, errors: 0 });
    expect(await storage.getAlert(contactDedupKey('m1'))).not.toBeNull();
    expect(errorSpy).toHaveBeenCalledOnce();

    // A second run does NOT re-attempt the send (dedup hit → skipped), and the
    // failing alert is never delivered twice.
    const second = await pollAndAlert(deps);
    expect(second).toEqual({ ok: true, polled: 1, newAlerts: 0, delivered: 0, skipped: 1, errors: 0 });
    expect(sendAttempts).toBe(1);
    errorSpy.mockRestore();
  });

  it('an individual-signal failure is logged + counted and the batch continues (§7)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = new InMemorySupportBotStorage(() => T0);
    await base.saveContactMessage(message('bad'));
    await base.saveContactMessage(message('good'));
    // A storage wrapper whose dedup read fails for ONE signal. Object.create
    // keeps the class prototype (methods); assign copies the own state.
    const flaky: SupportBotStorage = Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
      getAlert: async (id: string) => {
        if (id === contactDedupKey('bad')) throw new Error('ddb timeout');
        return base.getAlert(id);
      },
    });
    const { deps, storage } = makeDeps({ storage: flaky });
    void storage;

    const summary = await pollAndAlert(deps);
    expect(summary).toEqual({ ok: true, polled: 2, newAlerts: 1, delivered: 1, skipped: 0, errors: 1 });
    expect(await base.getAlert(contactDedupKey('good'))).not.toBeNull();
    expect(await base.getAlert(contactDedupKey('bad'))).toBeNull();
    errorSpy.mockRestore();
  });

  it('a source-poll failure THROWS (transient → EventBridge retries, §7)', async () => {
    const base = new InMemorySupportBotStorage(() => T0);
    const failing: SupportBotStorage = Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
      listNewContactMessages: async () => {
        throw new Error('ddb timeout');
      },
    });
    const { deps } = makeDeps({ storage: failing });
    await expect(pollAndAlert(deps)).rejects.toThrow('ddb timeout');
  });
});
