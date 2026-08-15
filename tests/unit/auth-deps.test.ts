import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAuthDeps } from '@/lib/auth/deps';
import { DynamoAuthStorage } from '@/lib/auth/dynamodb-storage';
import { SesEmailSender } from '@/lib/auth/ses-sender';
import { DummyEmailSender, InMemoryAuthStorage } from '@/lib/auth/dummy';

describe('getAuthDeps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the in-memory dummies', () => {
    const deps = getAuthDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryAuthStorage);
    expect(deps.emailSender).toBeInstanceOf(DummyEmailSender);
    expect(deps.testMode).toBe(false);
    expect(deps.dummyMode).toBe(true);
  });

  it('returns the shared dummy singleton (state survives between calls)', () => {
    const deps1 = getAuthDeps({});
    const deps2 = getAuthDeps({});
    expect(deps1.storage).toBe(deps2.storage);
  });

  it('sets testMode from AUTH_TEST_MODE', () => {
    expect(getAuthDeps({ AUTH_TEST_MODE: '1' }).testMode).toBe(true);
    expect(getAuthDeps({ AUTH_TEST_MODE: '0' }).testMode).toBe(false);
  });

  it('dummyMode requires BOTH deps to be dummies', () => {
    expect(getAuthDeps({ AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'dummy' }).dummyMode).toBe(true);
    expect(
      getAuthDeps({
        AUTH_STORAGE: 'dynamodb',
        AUTH_EMAIL: 'ses',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
        AUTH_OTP_TABLE: 'o',
        AUTH_PROGRESS_TABLE: 'p',
        SES_FROM_ADDRESS: 'noreply@octavlearning.com',
      }).dummyMode
    ).toBe(false);
  });

  it('wires real DynamoDB + SES adapters when configured', () => {
    const deps = getAuthDeps({
      AUTH_STORAGE: 'dynamodb',
      AUTH_EMAIL: 'ses',
      AUTH_USERS_TABLE: 'octav-users',
      AUTH_SESSIONS_TABLE: 'octav-sessions',
      AUTH_OTP_TABLE: 'octav-otp-codes',
      AUTH_PROGRESS_TABLE: 'octav-progress',
      SES_FROM_ADDRESS: 'noreply@octavlearning.com',
    });
    expect(deps.storage).toBeInstanceOf(DynamoAuthStorage);
    expect(deps.emailSender).toBeInstanceOf(SesEmailSender);
  });

  it('throws when the DynamoDB table names are missing', () => {
    expect(() =>
      getAuthDeps({ AUTH_STORAGE: 'dynamodb', AUTH_EMAIL: 'dummy', AUTH_USERS_TABLE: 'u' })
    ).toThrow(/AUTH_SESSIONS_TABLE/);
  });

  it('throws when SES is selected without a from-address', () => {
    expect(() => getAuthDeps({ AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'ses' })).toThrow(/SES_FROM_ADDRESS/);
  });

  it('throws on unknown kinds', () => {
    expect(() => getAuthDeps({ AUTH_STORAGE: 'postgres' })).toThrow(/AUTH_STORAGE/);
    expect(() => getAuthDeps({ AUTH_EMAIL: 'sendgrid' })).toThrow(/AUTH_EMAIL/);
  });
});
