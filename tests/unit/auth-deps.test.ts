import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAuthDeps } from '@/lib/auth/deps';
import { DynamoAuthStorage } from '@/lib/auth/dynamodb-storage';
import { SesEmailSender } from '@/lib/auth/ses-sender';
import { ResendEmailSender } from '@/lib/auth/resend-sender';
import { DummyEmailSender, InMemoryAuthStorage } from '@/lib/auth/dummy';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import { DynamoLeaderboardStorage } from '@/lib/leaderboard/dynamodb-storage';

const DDB_ENV = {
  AUTH_STORAGE: 'dynamodb',
  AUTH_EMAIL: 'dummy',
  AUTH_USERS_TABLE: 'u',
  AUTH_SESSIONS_TABLE: 's',
  AUTH_OTP_TABLE: 'o',
  AUTH_PROGRESS_TABLE: 'p',
  AUTH_RATE_LIMITS_TABLE: 'r',
};

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
        AUTH_RATE_LIMITS_TABLE: 'r',
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
      AUTH_RATE_LIMITS_TABLE: 'octav-rate-limits',
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

  it('throws when the rate-limits table name is missing', () => {
    expect(() =>
      getAuthDeps({
        AUTH_STORAGE: 'dynamodb',
        AUTH_EMAIL: 'dummy',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
        AUTH_OTP_TABLE: 'o',
        AUTH_PROGRESS_TABLE: 'p',
      })
    ).toThrow(/AUTH_RATE_LIMITS_TABLE/);
  });

  it('throws when SES is selected without a from-address', () => {
    expect(() => getAuthDeps({ AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'ses' })).toThrow(/SES_FROM_ADDRESS/);
  });

  it('throws on unknown kinds', () => {
    expect(() => getAuthDeps({ AUTH_STORAGE: 'postgres' })).toThrow(/AUTH_STORAGE/);
    expect(() => getAuthDeps({ AUTH_EMAIL: 'sendgrid' })).toThrow(/AUTH_EMAIL/);
  });

  describe('leaderboardStorage wiring (D5 — opt-out erasure)', () => {
    it('dummy wiring passes the SAME shared universe as leaderboardStorage', () => {
      const deps = getAuthDeps({});
      expect(deps.leaderboardStorage).toBeInstanceOf(InMemoryLeaderboardStorage);
      expect(deps.leaderboardStorage).toBe(deps.storage);
    });

    it('dynamodb wiring without LEADERBOARD_TABLE leaves erasure disabled (pre-D7)', () => {
      const deps = getAuthDeps(DDB_ENV);
      expect(deps.storage).toBeInstanceOf(DynamoAuthStorage);
      expect(deps.leaderboardStorage).toBeUndefined();
    });

    it('dynamodb wiring with LEADERBOARD_TABLE constructs the real adapter', () => {
      const deps = getAuthDeps({ ...DDB_ENV, LEADERBOARD_TABLE: 'octav-leaderboard' });
      expect(deps.leaderboardStorage).toBeInstanceOf(DynamoLeaderboardStorage);
    });
  });

  describe('EMAIL_PROVIDER selection (provider-swap seam)', () => {
    it('selects Resend from EMAIL_PROVIDER and overrides AUTH_EMAIL', () => {
      const deps = getAuthDeps({
        AUTH_EMAIL: 'ses',
        EMAIL_PROVIDER: JSON.stringify({ NAME: 'resend', API_KEY: 're_test' }),
      });
      expect(deps.emailSender).toBeInstanceOf(ResendEmailSender);
    });

    it('honors NAME case-insensitively', () => {
      const deps = getAuthDeps({
        EMAIL_PROVIDER: JSON.stringify({ NAME: 'RESEND', API_KEY: 're_x' }),
      });
      expect(deps.emailSender).toBeInstanceOf(ResendEmailSender);
    });

    it('selects SES from EMAIL_PROVIDER NAME=ses', () => {
      const deps = getAuthDeps({
        EMAIL_PROVIDER: JSON.stringify({ NAME: 'ses' }),
        SES_FROM_ADDRESS: 'noreply@octavlearning.com',
      });
      expect(deps.emailSender).toBeInstanceOf(SesEmailSender);
    });

    it('requires API_KEY when NAME is resend', () => {
      expect(() =>
        getAuthDeps({ EMAIL_PROVIDER: JSON.stringify({ NAME: 'resend' }) })
      ).toThrow(/EMAIL_PROVIDER.API_KEY/);
    });

    it('fails closed on malformed JSON', () => {
      expect(() => getAuthDeps({ EMAIL_PROVIDER: '{not json' })).toThrow(/valid single-line JSON/);
    });

    it('fails closed on an unknown NAME', () => {
      expect(() =>
        getAuthDeps({ EMAIL_PROVIDER: JSON.stringify({ NAME: 'mailgun' }) })
      ).toThrow(/EMAIL_PROVIDER.NAME/);
    });

    it('falls back to AUTH_EMAIL when EMAIL_PROVIDER is unset or "{}"', () => {
      expect(getAuthDeps({}).emailSender).toBeInstanceOf(DummyEmailSender);
      expect(
        getAuthDeps({ EMAIL_PROVIDER: '{}', AUTH_EMAIL: 'dummy' }).emailSender
      ).toBeInstanceOf(DummyEmailSender);
      expect(() => getAuthDeps({ EMAIL_PROVIDER: '{}', AUTH_EMAIL: 'ses' })).toThrow(/SES_FROM_ADDRESS/);
    });

    it('refuses NAME=dummy inside a Lambda without the opt-in', () => {
      expect(() =>
        getAuthDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-auth',
          EMAIL_PROVIDER: JSON.stringify({ NAME: 'dummy' }),
        })
      ).toThrow(/refusing dummy wiring/);
    });
  });

  describe('fail-closed dummy wiring in AWS Lambda (M1)', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getAuthDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-auth', AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'ses' })
      ).toThrow(/refusing dummy wiring/);
    });

    it('refuses dummy email inside a Lambda without the opt-in', () => {
      expect(() =>
        getAuthDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-auth',
          AUTH_STORAGE: 'dynamodb',
          AUTH_EMAIL: 'dummy',
          AUTH_USERS_TABLE: 'u',
          AUTH_SESSIONS_TABLE: 's',
          AUTH_OTP_TABLE: 'o',
          AUTH_PROGRESS_TABLE: 'p',
          AUTH_RATE_LIMITS_TABLE: 'r',
        })
      ).toThrow(/refusing dummy wiring/);
    });

    it('allows dummy wiring in a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAuthDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryAuthStorage);
      expect(deps.emailSender).toBeInstanceOf(DummyEmailSender);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in (round 4)', () => {
      expect(() =>
        getAuthDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-auth',
          NODE_ENV: 'test',
          AUTH_STORAGE: 'dynamodb',
          AUTH_EMAIL: 'ses',
          AUTH_USERS_TABLE: 'u',
          AUTH_SESSIONS_TABLE: 's',
          AUTH_OTP_TABLE: 'o',
          AUTH_PROGRESS_TABLE: 'p',
          AUTH_RATE_LIMITS_TABLE: 'r',
          SES_FROM_ADDRESS: 'noreply@octavlearning.com',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows NODE_ENV=test inside a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAuthDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', NODE_ENV: 'test', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryAuthStorage);
      expect(deps.emailSender).toBeInstanceOf(DummyEmailSender);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      const deps = getAuthDeps({ NODE_ENV: 'test', AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'dummy' });
      expect(deps.storage).toBeInstanceOf(InMemoryAuthStorage);
    });

    it('allows dummy wiring outside a Lambda (dev server) without any opt-in', () => {
      const deps = getAuthDeps({ AUTH_STORAGE: 'dummy', AUTH_EMAIL: 'dummy' });
      expect(deps.storage).toBeInstanceOf(InMemoryAuthStorage);
    });
  });
});
