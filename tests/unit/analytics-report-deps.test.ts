import { describe, it, expect } from 'vitest';
import { getAnalyticsReportDeps, parseRecipients } from '@/lib/analytics-report/deps';
import { InMemoryAnalyticsReportStorage } from '@/lib/analytics-report/dummy';
import { DummyReportSender } from '@/lib/analytics-report/dummy-sender';
import { DynamoAnalyticsReportStorage } from '@/lib/analytics-report/dynamodb-storage';
import { ResendReportSender } from '@/lib/analytics-report/resend-sender';
import { getSharedDummyUniverse } from '@/lib/progress/deps';

describe('getAnalyticsReportDeps', () => {
  it('defaults to the SHARED dummy universe wrapped by the report storage', () => {
    const deps = getAnalyticsReportDeps({});
    expect(deps.storage).toBeInstanceOf(InMemoryAnalyticsReportStorage);
    expect((deps.storage as InMemoryAnalyticsReportStorage)['universe']).toBe(getSharedDummyUniverse());
    expect(deps.sender).toBeInstanceOf(DummyReportSender);
  });

  it('defaults host to octavlearning.com and honors ANALYTICS_REPORT_HOST', () => {
    expect(getAnalyticsReportDeps({}).host).toBe('octavlearning.com');
    expect(getAnalyticsReportDeps({ ANALYTICS_REPORT_HOST: 'dev.octavlearning.com' }).host).toBe(
      'dev.octavlearning.com'
    );
  });

  it('parses recipients from ANALYTICS_ADMIN_EMAILS (trim, dedupe case-insensitive)', () => {
    expect(
      getAnalyticsReportDeps({ ANALYTICS_ADMIN_EMAILS: ' Admin@Example.com , admin@example.com, other@x.io ' }).recipients
    ).toEqual(['Admin@Example.com', 'other@x.io']);
    expect(getAnalyticsReportDeps({}).recipients).toEqual([]);
    expect(parseRecipients(' a@b.c, , b@c.d ')).toEqual(['a@b.c', 'b@c.d']);
  });

  it('wires DynamoAnalyticsReportStorage when ANALYTICS_REPORT_STORAGE=dynamodb', () => {
    const deps = getAnalyticsReportDeps({
      ANALYTICS_REPORT_STORAGE: 'dynamodb',
      ANALYTICS_TABLE: 'octav-analytics-events',
      // dynamodb mode ALSO requires a real (resend) sender — see the guard test.
      EMAIL_PROVIDER: '{"NAME":"resend","API_KEY":"re_123"}',
    });
    expect(deps.storage).toBeInstanceOf(DynamoAnalyticsReportStorage);
  });

  it('throws on a missing ANALYTICS_TABLE in dynamodb mode', () => {
    expect(() => getAnalyticsReportDeps({ ANALYTICS_REPORT_STORAGE: 'dynamodb' })).toThrow(/ANALYTICS_TABLE/);
  });

  it('wires a Resend sender from EMAIL_PROVIDER and refuses a no-op sender in dynamodb mode', () => {
    const deps = getAnalyticsReportDeps({
      ANALYTICS_REPORT_STORAGE: 'dynamodb',
      ANALYTICS_TABLE: 'e',
      EMAIL_PROVIDER: '{"NAME":"resend","API_KEY":"re_123"}',
    });
    expect(deps.sender).toBeInstanceOf(ResendReportSender);

    // dynamodb mode without EMAIL_PROVIDER must NOT silently no-op-send.
    expect(() =>
      getAnalyticsReportDeps({ ANALYTICS_REPORT_STORAGE: 'dynamodb', ANALYTICS_TABLE: 'e' })
    ).toThrow(/NAME must be "resend"/);
    expect(() =>
      getAnalyticsReportDeps({
        ANALYTICS_REPORT_STORAGE: 'dynamodb',
        ANALYTICS_TABLE: 'e',
        EMAIL_PROVIDER: '{"NAME":"dummy"}',
      })
    ).toThrow(/NAME must be "resend"/);
  });

  it('fails closed on malformed/unknown EMAIL_PROVIDER values', () => {
    expect(() => getAnalyticsReportDeps({ EMAIL_PROVIDER: '{nope' })).toThrow(/single-line JSON/);
    expect(() => getAnalyticsReportDeps({ EMAIL_PROVIDER: '{"NAME":"ses","API_KEY":"k"}' })).toThrow(/must be "resend" or "dummy"/);
    expect(() => getAnalyticsReportDeps({ EMAIL_PROVIDER: '{"NAME":"resend"}' })).toThrow(/API_KEY is required/);
    // Unset/"{}" = no provider → dummy sender (dev mode).
    expect(getAnalyticsReportDeps({ EMAIL_PROVIDER: '{}' }).sender).toBeInstanceOf(DummyReportSender);
  });

  it('throws on an unknown storage kind', () => {
    expect(() => getAnalyticsReportDeps({ ANALYTICS_REPORT_STORAGE: 'postgres' })).toThrow(/ANALYTICS_REPORT_STORAGE/);
  });

  describe('fail-closed guards in AWS Lambda', () => {
    it('refuses dummy storage inside a Lambda without the opt-in', () => {
      expect(() => getAnalyticsReportDeps({ AWS_LAMBDA_FUNCTION_NAME: 'iblearn-analytics-report' })).toThrow(
        /refusing dummy storage/
      );
    });

    it('refuses NODE_ENV=test inside a Lambda without the opt-in', () => {
      expect(() =>
        getAnalyticsReportDeps({
          AWS_LAMBDA_FUNCTION_NAME: 'x',
          ANALYTICS_REPORT_STORAGE: 'dynamodb',
          ANALYTICS_TABLE: 'e',
          NODE_ENV: 'test',
        })
      ).toThrow(/NODE_ENV=test/);
    });

    it('allows dummy wiring inside a Lambda with AUTH_ALLOW_DUMMY=1', () => {
      const deps = getAnalyticsReportDeps({ AWS_LAMBDA_FUNCTION_NAME: 'x', AUTH_ALLOW_DUMMY: '1' });
      expect(deps.storage).toBeInstanceOf(InMemoryAnalyticsReportStorage);
    });
  });
});
