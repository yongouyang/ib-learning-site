import { describe, it, expect, afterEach, vi } from 'vitest';
import { getLeaderboardDeps } from '@/lib/leaderboard/deps';
import { DynamoLeaderboardStorage } from '@/lib/leaderboard/dynamodb-storage';
import { InMemoryLeaderboardStorage } from '@/lib/leaderboard/dummy';
import { getAuthDeps } from '@/lib/auth/deps';
import { getSharedDummyUniverse } from '@/lib/progress/deps';

// Deps wiring for the leaderboard handler (Phase D3) — mirrors
// feedback-deps.test.ts / analytics-deps.test.ts.

describe('getLeaderboardDeps', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the shared in-memory dummy universe with the real clock', () => {
    const deps = getLeaderboardDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryLeaderboardStorage);
    expect(deps.clock).toBe(Date.now);
  });

  it('returns the shared dummy singleton — the SAME universe the auth deps see', () => {
    const deps1 = getLeaderboardDeps({});
    const deps2 = getLeaderboardDeps({});
    expect(deps1.storage).toBe(deps2.storage);
    expect(deps1.storage).toBe(getSharedDummyUniverse());
    // A dummy-OTP session written by the auth handler resolves for the
    // leaderboard: both read one in-memory universe.
    expect(getAuthDeps({}).storage).toBe(deps1.storage as never);
  });

  it('wires the real DynamoDB adapter when configured', () => {
    const deps = getLeaderboardDeps({
      LEADERBOARD_STORAGE: 'dynamodb',
      AUTH_USERS_TABLE: 'octav-users',
      AUTH_SESSIONS_TABLE: 'octav-sessions',
      LEADERBOARD_TABLE: 'octav-leaderboard',
    });
    expect(deps.storage).toBeInstanceOf(DynamoLeaderboardStorage);
    expect(deps.clock).toBe(Date.now);
  });

  it('throws when the DynamoDB table names are missing', () => {
    expect(() => getLeaderboardDeps({ LEADERBOARD_STORAGE: 'dynamodb' })).toThrow(/AUTH_USERS_TABLE/);
    expect(() =>
      getLeaderboardDeps({ LEADERBOARD_STORAGE: 'dynamodb', AUTH_USERS_TABLE: 'u' })
    ).toThrow(/AUTH_SESSIONS_TABLE/);
    expect(() =>
      getLeaderboardDeps({
        LEADERBOARD_STORAGE: 'dynamodb',
        AUTH_USERS_TABLE: 'u',
        AUTH_SESSIONS_TABLE: 's',
      })
    ).toThrow(/LEADERBOARD_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getLeaderboardDeps({ LEADERBOARD_STORAGE: 'redis' })).toThrow(/LEADERBOARD_STORAGE/);
  });

  describe('fail-closed dummy wiring in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() =>
        getLeaderboardDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-leaderboard', LEADERBOARD_STORAGE: 'dummy' })
      ).toThrow(/refusing dummy storage/);
    });

    it('allows dummy wiring in a Lambda only with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getLeaderboardDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryLeaderboardStorage);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getLeaderboardDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-leaderboard',
          NODE_ENV: 'test',
          LEADERBOARD_STORAGE: 'dynamodb',
          AUTH_USERS_TABLE: 'u',
          AUTH_SESSIONS_TABLE: 's',
          LEADERBOARD_TABLE: 'l',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows NODE_ENV=test outside a Lambda (vitest/dev)', () => {
      const deps = getLeaderboardDeps({ NODE_ENV: 'test' });
      expect(deps.storage).toBeInstanceOf(InMemoryLeaderboardStorage);
    });
  });
});
