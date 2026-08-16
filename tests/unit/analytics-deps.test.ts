import { describe, it, expect } from 'vitest';
import { getAnalyticsDeps } from '@/lib/analytics/deps';
import { DynamoAnalyticsStorage } from '@/lib/analytics/dynamodb-storage';
import { InMemoryAnalyticsStorage } from '@/lib/analytics/dummy';
import { getAuthDeps } from '@/lib/auth/deps';
import { getSharedDummyUniverse } from '@/lib/progress/deps';

describe('getAnalyticsDeps', () => {
  it('defaults to the SHARED dummy universe (same instance the auth deps use)', () => {
    const deps = getAnalyticsDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryAnalyticsStorage);
    // One universe: a dummy-OTP login through the auth deps resolves for
    // /summary through the analytics deps.
    expect(deps.storage).toBe(getSharedDummyUniverse());
    expect(getAuthDeps({}).storage).toBe(getSharedDummyUniverse());
  });

  it('passes the ANALYTICS_ADMIN_EMAILS allowlist through', () => {
    expect(getAnalyticsDeps({ ANALYTICS_ADMIN_EMAILS: 'a@example.com' }).adminEmails).toBe('a@example.com');
    expect(getAnalyticsDeps({}).adminEmails).toBe('');
  });

  it('wires DynamoAnalyticsStorage when ANALYTICS_STORAGE=dynamodb', () => {
    const deps = getAnalyticsDeps({
      ANALYTICS_STORAGE: 'dynamodb',
      AUTH_USERS_TABLE: 'u',
      AUTH_SESSIONS_TABLE: 's',
      ANALYTICS_TABLE: 'e',
      AUTH_RATE_LIMITS_TABLE: 'r',
    });
    expect(deps.storage).toBeInstanceOf(DynamoAnalyticsStorage);
  });

  it('throws on missing table names, mentioning the missing name', () => {
    expect(() => getAnalyticsDeps({ ANALYTICS_STORAGE: 'dynamodb' })).toThrow(/AUTH_USERS_TABLE/);
    expect(() => getAnalyticsDeps({ ANALYTICS_STORAGE: 'dynamodb', AUTH_USERS_TABLE: 'u' })).toThrow(/AUTH_SESSIONS_TABLE/);
    expect(() =>
      getAnalyticsDeps({
        ANALYTICS_STORAGE: 'dynamodb',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
      })
    ).toThrow(/ANALYTICS_TABLE/);
    expect(() =>
      getAnalyticsDeps({
        ANALYTICS_STORAGE: 'dynamodb',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
        ANALYTICS_TABLE: 'e',
      })
    ).toThrow(/AUTH_RATE_LIMITS_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getAnalyticsDeps({ ANALYTICS_STORAGE: 'postgres' })).toThrow(/ANALYTICS_STORAGE/);
  });

  describe('fail-closed guards in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() => getAnalyticsDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-analytics' })).toThrow(/refusing dummy storage/);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getAnalyticsDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-analytics',
          ANALYTICS_STORAGE: 'dynamodb',
          NODE_ENV: 'test',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows dummy storage in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAnalyticsDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryAnalyticsStorage);
    });

    it('allows NODE_ENV=test in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAnalyticsDeps({
        AWS_LAMBDA_FUNCTION_NAME: 'x',
        NODE_ENV: 'test',
        AUTH_ALLOW_DUMMY: '1',
      });
      expect(deps.storage).toBeInstanceOf(InMemoryAnalyticsStorage);
    });

    it('allows dummy storage and NODE_ENV=test outside a Lambda without any opt-in', () => {
      expect(getAnalyticsDeps({}).storage).toBeInstanceOf(InMemoryAnalyticsStorage);
      expect(getAnalyticsDeps({ NODE_ENV: 'test' }).storage).toBeInstanceOf(InMemoryAnalyticsStorage);
    });
  });
});
