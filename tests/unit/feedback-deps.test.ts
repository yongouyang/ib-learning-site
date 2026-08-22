import { describe, it, expect, afterEach, vi } from 'vitest';
import { getFeedbackDeps } from '@/lib/feedback/deps';
import { DynamoFeedbackStorage } from '@/lib/feedback/dynamodb-storage';
import { InMemoryFeedbackStorage } from '@/lib/feedback/dummy';
import { getAuthDeps } from '@/lib/auth/deps';

// Deps wiring for the feedback handler (Phase E2) — mirrors auth-deps.test.ts.

describe('getFeedbackDeps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the shared in-memory dummy universe', () => {
    const deps = getFeedbackDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryFeedbackStorage);
    expect(deps.testMode).toBe(false);
    expect(deps.dummyMode).toBe(true);
  });

  it('returns the shared dummy singleton — the SAME universe the auth deps see', () => {
    const deps1 = getFeedbackDeps({});
    const deps2 = getFeedbackDeps({});
    expect(deps1.storage).toBe(deps2.storage);
    // A dummy-OTP session written by the auth handler resolves for feedback:
    // both read one in-memory universe.
    expect(getAuthDeps({}).storage).toBe(deps1.storage as never);
  });

  it('sets testMode from FEEDBACK_TEST_MODE', () => {
    expect(getFeedbackDeps({ FEEDBACK_TEST_MODE: '1' }).testMode).toBe(true);
    expect(getFeedbackDeps({ FEEDBACK_TEST_MODE: '0' }).testMode).toBe(false);
  });

  it('wires the real DynamoDB adapter when configured', () => {
    const deps = getFeedbackDeps({
      FEEDBACK_STORAGE: 'dynamodb',
      AUTH_USERS_TABLE: 'octav-users',
      AUTH_SESSIONS_TABLE: 'octav-sessions',
      AUTH_RATE_LIMITS_TABLE: 'octav-rate-limits',
    });
    expect(deps.storage).toBeInstanceOf(DynamoFeedbackStorage);
    expect(deps.dummyMode).toBe(false);
  });

  it('throws when the DynamoDB table names are missing', () => {
    expect(() => getFeedbackDeps({ FEEDBACK_STORAGE: 'dynamodb', AUTH_USERS_TABLE: 'u' })).toThrow(
      /AUTH_SESSIONS_TABLE/
    );
    expect(() =>
      getFeedbackDeps({
        FEEDBACK_STORAGE: 'dynamodb',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
      })
    ).toThrow(/AUTH_RATE_LIMITS_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getFeedbackDeps({ FEEDBACK_STORAGE: 'redis' })).toThrow(/FEEDBACK_STORAGE/);
  });

  describe('fail-closed dummy wiring in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getFeedbackDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-feedback', FEEDBACK_STORAGE: 'dummy' })
      ).toThrow(/refusing dummy storage/);
    });

    it('allows dummy wiring in a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getFeedbackDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryFeedbackStorage);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getFeedbackDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-feedback',
          NODE_ENV: 'test',
          FEEDBACK_STORAGE: 'dynamodb',
          AUTH_USERS_TABLE: 'u',
          AUTH_SESSIONS_TABLE: 's',
          AUTH_RATE_LIMITS_TABLE: 'r',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      const deps = getFeedbackDeps({ NODE_ENV: 'test' });
      expect(deps.storage).toBeInstanceOf(InMemoryFeedbackStorage);
    });
  });
});
