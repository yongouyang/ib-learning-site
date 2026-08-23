import { describe, it, expect } from 'vitest';
import { getAdminDeps } from '@/lib/admin/deps';
import { DynamoAdminStorage } from '@/lib/admin/dynamodb-storage';
import { InMemoryAdminStorage, getAdminDummy } from '@/lib/admin/dummy';
import { getSharedDummyUniverse } from '@/lib/progress/deps';

describe('getAdminDeps', () => {
  it('defaults to the seeded dummy CRUD store + the SHARED session universe', () => {
    const deps = getAdminDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryAdminStorage);
    expect(deps.storage).toBe(getAdminDummy());
    // Session validation rides the shared auth/progress universe so a
    // dummy-OTP login resolves for the admin gate in dev/e2e.
    expect(deps.sessionStorage).toBe(getSharedDummyUniverse());
  });

  it('passes the ANALYTICS_ADMIN_EMAILS allowlist through (reused from analytics)', () => {
    expect(getAdminDeps({ ANALYTICS_ADMIN_EMAILS: 'a@example.com' }).adminEmails).toBe('a@example.com');
    expect(getAdminDeps({}).adminEmails).toBe('');
  });

  it('wires DynamoAdminStorage + DynamoSessionStorage when ADMIN_STORAGE=dynamodb', () => {
    const deps = getAdminDeps({
      ADMIN_STORAGE: 'dynamodb',
      AUTH_USERS_TABLE: 'u',
      AUTH_SESSIONS_TABLE: 's',
    });
    expect(deps.storage).toBeInstanceOf(DynamoAdminStorage);
  });

  it('throws on missing table names, mentioning the missing name', () => {
    expect(() => getAdminDeps({ ADMIN_STORAGE: 'dynamodb' })).toThrow(/AUTH_USERS_TABLE/);
    expect(() => getAdminDeps({ ADMIN_STORAGE: 'dynamodb', AUTH_USERS_TABLE: 'u' })).toThrow(/AUTH_SESSIONS_TABLE/);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getAdminDeps({ ADMIN_STORAGE: 'postgres' })).toThrow(/ADMIN_STORAGE/);
  });

  describe('fail-closed guards in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() => getAdminDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-admin' })).toThrow(/refusing dummy storage/);
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getAdminDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'iblearn-admin',
          ADMIN_STORAGE: 'dynamodb',
          NODE_ENV: 'test',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows dummy storage in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAdminDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryAdminStorage);
    });

    it('allows NODE_ENV=test in a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAdminDeps({
        AWS_LAMBDA_FUNCTION_NAME: 'x',
        NODE_ENV: 'test',
        AUTH_ALLOW_DUMMY: '1',
      });
      expect(deps.storage).toBeInstanceOf(InMemoryAdminStorage);
    });

    it('allows dummy storage and NODE_ENV=test outside a Lambda without any opt-in', () => {
      expect(getAdminDeps({}).storage).toBeInstanceOf(InMemoryAdminStorage);
      expect(getAdminDeps({ NODE_ENV: 'test' }).storage).toBeInstanceOf(InMemoryAdminStorage);
    });
  });
});
