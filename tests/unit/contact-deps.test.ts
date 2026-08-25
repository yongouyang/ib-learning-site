import { describe, it, expect, afterEach, vi } from 'vitest';
import { getContactDeps } from '@/lib/contact/deps';
import { DynamoContactStorage } from '@/lib/contact/dynamodb-storage';
import { InMemoryContactStorage } from '@/lib/contact/dummy';
import { DummyReportSender } from '@/lib/analytics-report/dummy-sender';
import { ResendReportSender } from '@/lib/analytics-report/resend-sender';
import { getAuthDeps } from '@/lib/auth/deps';

// Deps wiring for the contact handler (Feature 3) — mirrors
// feedback-deps.test.ts + the analytics-report email-sender guard.

const RESEND = JSON.stringify({ NAME: 'resend', API_KEY: 're_test_key' });

const DYNAMODB_ENV = {
  CONTACT_STORAGE: 'dynamodb',
  AUTH_USERS_TABLE: 'octav-users',
  AUTH_SESSIONS_TABLE: 'octav-sessions',
  AUTH_RATE_LIMITS_TABLE: 'octav-rate-limits',
  CONTACT_TABLE: 'octav-contact',
  EMAIL_PROVIDER: RESEND,
};

describe('getContactDeps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the shared in-memory dummy universe + no-op sender', () => {
    const deps = getContactDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryContactStorage);
    expect(deps.sender).toBeInstanceOf(DummyReportSender);
    expect(deps.recipients).toEqual([]);
  });

  it('returns the shared dummy singleton — the SAME universe the auth deps see', () => {
    const deps1 = getContactDeps({});
    const deps2 = getContactDeps({});
    expect(deps1.storage).toBe(deps2.storage);
    // A dummy-OTP session written by the auth handler resolves for contact:
    // both read one in-memory universe.
    expect(getAuthDeps({}).storage).toBe(deps1.storage as never);
  });

  it('parses ANALYTICS_ADMIN_EMAILS into trimmed, deduped recipients', () => {
    const deps = getContactDeps({ ANALYTICS_ADMIN_EMAILS: ' Boss@Example.com ,boss@example.com, other@example.com ' });
    expect(deps.recipients).toEqual(['Boss@Example.com', 'other@example.com']);
  });

  it('wires the real DynamoDB adapter + Resend sender when configured', () => {
    const deps = getContactDeps({ ...DYNAMODB_ENV, ANALYTICS_ADMIN_EMAILS: 'admin@example.com' });
    expect(deps.storage).toBeInstanceOf(DynamoContactStorage);
    expect(deps.sender).toBeInstanceOf(ResendReportSender);
    expect(deps.recipients).toEqual(['admin@example.com']);
  });

  it('throws when the DynamoDB table names are missing', () => {
    expect(() => getContactDeps({ ...DYNAMODB_ENV, CONTACT_TABLE: undefined })).toThrow(/CONTACT_TABLE/);
    expect(() => getContactDeps({ ...DYNAMODB_ENV, AUTH_RATE_LIMITS_TABLE: undefined })).toThrow(
      /AUTH_RATE_LIMITS_TABLE/
    );
    expect(() => getContactDeps({ ...DYNAMODB_ENV, AUTH_USERS_TABLE: undefined })).toThrow(/AUTH_USERS_TABLE/);
  });

  it('refuses a no-op/dummy sender in dynamodb mode (production safety)', () => {
    // No EMAIL_PROVIDER at all → DummyReportSender → refused.
    const { EMAIL_PROVIDER: _omit, ...noProvider } = DYNAMODB_ENV;
    expect(() => getContactDeps(noProvider)).toThrow(/EMAIL_PROVIDER.NAME must be "resend"/);
    // Explicit dummy provider → same refusal.
    expect(() =>
      getContactDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'dummy' }) })
    ).toThrow(/EMAIL_PROVIDER.NAME must be "resend"/);
  });

  it('requires API_KEY when EMAIL_PROVIDER.NAME is "resend"', () => {
    expect(() =>
      getContactDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'resend' }) })
    ).toThrow(/EMAIL_PROVIDER.API_KEY/);
  });

  it('refuses SES (Resend-only feature) and malformed EMAIL_PROVIDER JSON', () => {
    expect(() =>
      getContactDeps({ ...DYNAMODB_ENV, EMAIL_PROVIDER: JSON.stringify({ NAME: 'ses', API_KEY: 'x' }) })
    ).toThrow(/EMAIL_PROVIDER.NAME must be "resend" or "dummy"/);
    expect(() => getContactDeps({ EMAIL_PROVIDER: '{not json' })).toThrow(/valid single-line JSON/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getContactDeps({ CONTACT_STORAGE: 'redis' })).toThrow(/CONTACT_STORAGE/);
  });

  describe('fail-closed dummy wiring in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getContactDeps({ AWS_LAMBDA_FUNCTION_NAME: 'octav-contact', CONTACT_STORAGE: 'dummy' })
      ).toThrow(/refusing dummy storage/);
    });

    it('allows dummy wiring in a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getContactDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryContactStorage);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getContactDeps({ AWS_LAMBDA_FUNCTION_NAME: 'octav-contact', NODE_ENV: 'test', ...DYNAMODB_ENV })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      const deps = getContactDeps({ NODE_ENV: 'test' });
      expect(deps.storage).toBeInstanceOf(InMemoryContactStorage);
    });
  });
});
