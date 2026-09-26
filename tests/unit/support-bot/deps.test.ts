import { describe, it, expect } from 'vitest';
import { getSharedSupportBotUniverse, getSupportBotDeps } from '@/lib/support-bot/deps';
import { DummyAlertDelivery } from '@/lib/support-bot/delivery/dummy-sender';
import { ResendAlertDelivery } from '@/lib/support-bot/delivery/resend-sender';
import { DynamoSupportBotStorage } from '@/lib/support-bot/dynamodb-storage';
import { InMemorySupportBotStorage } from '@/lib/support-bot/dummy';
import { RuleBasedTriageProvider } from '@/lib/support-bot/triage/rule-based';

// Deps wiring for the support bot — mirrors contact-deps.test.ts /
// analytics-report-deps.test.ts (env-driven selection + fail-closed guards),
// S3 adds the Resend delivery wiring.

const RESEND = JSON.stringify({ NAME: 'resend', API_KEY: 're_test_key' });

const DYNAMODB_ENV = {
  SUPPORT_BOT_STORAGE: 'dynamodb',
  SUPPORT_ALERTS_TABLE: 'octav-support-alerts',
  CONTACT_TABLE: 'octav-contact',
  ANALYTICS_TABLE: 'octav-analytics-events',
  EMAIL_PROVIDER: RESEND,
  ANALYTICS_ADMIN_EMAILS: 'admin@example.com',
};

describe('getSupportBotDeps', () => {
  it('defaults to the dummy universe + rule-based triage + recording dummy delivery', () => {
    const deps = getSupportBotDeps({});
    expect(deps.storage).toBeInstanceOf(InMemorySupportBotStorage);
    expect(deps.triage).toBeInstanceOf(RuleBasedTriageProvider);
    expect(deps.delivery).toBeInstanceOf(DummyAlertDelivery);
    expect(deps.recipients).toEqual([]);
    expect(deps.prodHost).toBe('octavlearning.com');
    expect(deps.clock).toBe(Date.now);
  });

  it('returns the shared bot dummy singleton across calls', () => {
    const deps1 = getSupportBotDeps({});
    const deps2 = getSupportBotDeps({});
    expect(deps1.storage).toBe(deps2.storage);
    expect(deps1.storage).toBe(getSharedSupportBotUniverse());
  });

  it('parses ANALYTICS_ADMIN_EMAILS into trimmed, deduped recipients', () => {
    const deps = getSupportBotDeps({ ANALYTICS_ADMIN_EMAILS: ' Boss@Example.com ,boss@example.com, other@example.com ' });
    expect(deps.recipients).toEqual(['Boss@Example.com', 'other@example.com']);
  });

  it('wires the real DynamoDB adapter + Resend delivery when configured', () => {
    const deps = getSupportBotDeps(DYNAMODB_ENV);
    expect(deps.storage).toBeInstanceOf(DynamoSupportBotStorage);
    expect(deps.delivery).toBeInstanceOf(ResendAlertDelivery);
    expect(deps.recipients).toEqual(['admin@example.com']);
  });

  it('throws when a DynamoDB table name is missing', () => {
    expect(() => getSupportBotDeps({ ...DYNAMODB_ENV, SUPPORT_ALERTS_TABLE: undefined })).toThrow(
      /SUPPORT_ALERTS_TABLE/
    );
    expect(() => getSupportBotDeps({ ...DYNAMODB_ENV, CONTACT_TABLE: undefined })).toThrow(/CONTACT_TABLE/);
    expect(() => getSupportBotDeps({ ...DYNAMODB_ENV, ANALYTICS_TABLE: undefined })).toThrow(/ANALYTICS_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getSupportBotDeps({ SUPPORT_BOT_STORAGE: 'redis' })).toThrow(/SUPPORT_BOT_STORAGE/);
  });

  it('SUPPORT_BOT_PROD_HOST overrides the prod hostname', () => {
    expect(getSupportBotDeps({ SUPPORT_BOT_PROD_HOST: 'www.example.com' }).prodHost).toBe('www.example.com');
  });

  it('refuses SUPPORT_BOT_TRIAGE_PROVIDER=deepseek (a v1.1 feature) and unknown values', () => {
    expect(() => getSupportBotDeps({ SUPPORT_BOT_TRIAGE_PROVIDER: 'deepseek' })).toThrow(/v1\.1/);
    expect(() => getSupportBotDeps({ SUPPORT_BOT_TRIAGE_PROVIDER: 'magic' })).toThrow(
      /SUPPORT_BOT_TRIAGE_PROVIDER/
    );
    expect(getSupportBotDeps({ SUPPORT_BOT_TRIAGE_PROVIDER: 'rule-based' }).triage).toBeInstanceOf(
      RuleBasedTriageProvider
    );
  });

  it('refuses a no-op/dummy delivery in dynamodb mode (production safety)', () => {
    // No EMAIL_PROVIDER at all → DummyAlertDelivery → refused.
    const { EMAIL_PROVIDER: _omit, ...noProvider } = DYNAMODB_ENV;
    expect(() => getSupportBotDeps(noProvider)).toThrow(/EMAIL_PROVIDER.NAME must be "resend"/);
    // Explicit dummy provider → same refusal.
    expect(() =>
      getSupportBotDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'dummy' }) })
    ).toThrow(/EMAIL_PROVIDER.NAME must be "resend"/);
  });

  it('requires API_KEY when EMAIL_PROVIDER.NAME is "resend"', () => {
    expect(() =>
      getSupportBotDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'resend' }) })
    ).toThrow(/EMAIL_PROVIDER.API_KEY/);
  });

  it('refuses SES (Resend-only feature) and malformed EMAIL_PROVIDER JSON', () => {
    expect(() =>
      getSupportBotDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'ses', API_KEY: 'x' }) })
    ).toThrow(/EMAIL_PROVIDER.NAME must be "resend" or "dummy"/);
    expect(() => getSupportBotDeps({ EMAIL_PROVIDER: '{not json' })).toThrow(/valid single-line JSON/);
  });

  it('does NOT throw on empty recipients — the handler returns ok:false instead (§11 retry-storm avoidance)', () => {
    const deps = getSupportBotDeps({ ...DYNAMODB_ENV, ANALYTICS_ADMIN_EMAILS: '' });
    expect(deps.delivery).toBeInstanceOf(ResendAlertDelivery);
    expect(deps.recipients).toEqual([]);
  });

  describe('fail-closed dummy wiring in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getSupportBotDeps({ AWS_LAMBDA_FUNCTION_NAME: 'octav-support-bot', SUPPORT_BOT_STORAGE: 'dummy' })
      ).toThrow(/refusing dummy storage/);
    });

    it('allows dummy wiring in a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getSupportBotDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemorySupportBotStorage);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getSupportBotDeps({ AWS_LAMBDA_FUNCTION_NAME: 'octav-support-bot', NODE_ENV: 'test', ...DYNAMODB_ENV })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      const deps = getSupportBotDeps({ NODE_ENV: 'test' });
      expect(deps.storage).toBeInstanceOf(InMemorySupportBotStorage);
    });
  });
});

describe('DummyAlertDelivery (the S3 recording dummy)', () => {
  it('records delivered alerts', async () => {
    const delivery = new DummyAlertDelivery();
    const alert = {
      alertId: 'a1',
      source: 'contact' as const,
      sourceRef: 'm1',
      severity: 'high' as const,
      title: 't',
      body: 'b',
      status: 'open' as const,
      createdAt: 'now',
      updatedAt: 'now',
      resolvedAt: null,
      dedupKey: 'a1',
      expiresAt: 0,
    };
    await delivery.deliver(alert);
    expect(delivery.sent).toEqual([alert]);
  });

  it('failNext injects a one-shot delivery failure', async () => {
    const delivery = new DummyAlertDelivery();
    delivery.failNext = true;
    await expect(
      delivery.deliver({ alertId: 'a1' } as never)
    ).rejects.toThrow(/dummy delivery failure/);
    expect(delivery.failNext).toBe(false); // one-shot
    expect(delivery.sent).toHaveLength(0);
  });
});
