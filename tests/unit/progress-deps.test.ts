import { describe, it, expect } from 'vitest';
import { getProgressDeps, getSharedDummyUniverse } from '@/lib/progress/deps';
import { DynamoProgressStorage } from '@/lib/progress/dynamodb-storage';
import { InMemoryProgressStorage } from '@/lib/progress/dummy';

describe('getProgressDeps', () => {
  it('defaults to the shared dummy universe', () => {
    const deps = getProgressDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryProgressStorage);
  });

  it('getSharedDummyUniverse returns the SAME instance across calls', () => {
    // The module singleton persists per test FILE — assert identity within
    // this one test rather than relying on ordering across tests.
    expect(getSharedDummyUniverse()).toBe(getSharedDummyUniverse());
    expect(getProgressDeps({}).storage).toBe(getSharedDummyUniverse());
  });

  it('wires DynamoProgressStorage when PROGRESS_STORAGE=dynamodb', () => {
    const deps = getProgressDeps({
      PROGRESS_STORAGE: 'dynamodb',
      AUTH_USERS_TABLE: 'u',
      AUTH_SESSIONS_TABLE: 's',
      AUTH_OTP_TABLE: 'o',
      AUTH_PROGRESS_TABLE: 'p',
      AUTH_RATE_LIMITS_TABLE: 'r',
    });
    expect(deps.storage).toBeInstanceOf(DynamoProgressStorage);
  });

  it('throws on a missing table name, mentioning the missing name', () => {
    expect(() => getProgressDeps({ PROGRESS_STORAGE: 'dynamodb' })).toThrow(/AUTH_USERS_TABLE/);
    expect(() => getProgressDeps({ PROGRESS_STORAGE: 'dynamodb', AUTH_USERS_TABLE: 'u' })).toThrow(
      /AUTH_SESSIONS_TABLE/
    );
    // users + sessions + otp supplied; the progress table is the next required name.
    expect(() =>
      getProgressDeps({
        PROGRESS_STORAGE: 'dynamodb',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
        AUTH_OTP_TABLE: 'o',
      })
    ).toThrow(/AUTH_PROGRESS_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getProgressDeps({ PROGRESS_STORAGE: 'postgres' })).toThrow(/PROGRESS_STORAGE/);
  });

  describe('fail-closed guards in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getProgressDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-progress' })
      ).toThrow(/refusing dummy storage/);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getProgressDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-progress',
          PROGRESS_STORAGE: 'dynamodb',
          NODE_ENV: 'test',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows dummy storage in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getProgressDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryProgressStorage);
    });

    it('allows NODE_ENV=test in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getProgressDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', NODE_ENV: 'test', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryProgressStorage);
    });

    it('allows dummy storage outside a Lambda without any opt-in', () => {
      expect(getProgressDeps({}).storage).toBeInstanceOf(InMemoryProgressStorage);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      expect(getProgressDeps({ NODE_ENV: 'test' }).storage).toBeInstanceOf(InMemoryProgressStorage);
    });
  });
});
