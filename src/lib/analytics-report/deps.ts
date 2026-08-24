import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getSharedDummyUniverse } from '../progress/deps';
import { InMemoryAnalyticsReportStorage } from './dummy';
import { DummyReportSender } from './dummy-sender';
import { DynamoAnalyticsReportStorage } from './dynamodb-storage';
import { ResendReportSender } from './resend-sender';
import { ANALYTICS_REPORT_DEFAULT_HOST } from './types';
import type { AnalyticsReportStorage, ReportEmailSender } from './types';

// Dependency wiring for the daily analytics report (mirrors the other feature
// deps seams):
//   ANALYTICS_REPORT_STORAGE = "dummy" (default) | "dynamodb"
//   ANALYTICS_TABLE           = octav-analytics-events (dynamodb mode)
//   EMAIL_PROVIDER            = '{"NAME":"resend|dummy","API_KEY":"..."}' —
//                               the SAME repo secret the auth Lambda uses.
//                               NAME "ses" is refused here (the report needs a
//                               transactional send API; SES stays auth-only).
//   ANALYTICS_ADMIN_EMAILS    = comma-separated report recipients (the same
//                               allowlist the /summary endpoint + admin
//                               dashboard use — the plan's singular
//                               ANALYTICS_ADMIN_EMAIL maps to this existing
//                               repo variable; no new secret/variable needed).
//   ANALYTICS_REPORT_HOST     = the prod hostname highlighted in the traffic
//                               split (default octavlearning.com).
//   SES_FROM_ADDRESS          = from-address (default noreply@octavlearning.com
//                               — the verified Resend domain).
// Defaults are the dummies: local dev and tests run with zero AWS resources
// and zero emails. The same fail-closed guards as every other deps seam apply:
// dummy wiring and NODE_ENV=test are refused inside AWS Lambda unless
// AUTH_ALLOW_DUMMY=1.

export interface AnalyticsReportDeps {
  storage: AnalyticsReportStorage;
  sender: ReportEmailSender;
  /** Deduped, trimmed report recipients (from ANALYTICS_ADMIN_EMAILS). */
  recipients: string[];
  /** Prod hostname whose share the report highlights. */
  host: string;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`[analytics-report] ${name} is required when using the real AWS wiring`);
  }
  return value;
}

/** Comma-separated → trimmed, deduped (case-insensitive) recipients. */
export function parseRecipients(raw: string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const email = part.trim();
    if (!email) continue;
    const lower = email.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(email);
  }
  return out;
}

// EMAIL_PROVIDER JSON ({"NAME","API_KEY"}) — same format the auth deps parse.
// Missing/empty/"{}" = no sender configured (the handler fails the report
// without sending rather than silently picking the dummy in production).
// Malformed JSON or an unknown NAME fails closed.
function parseEmailProvider(env: Record<string, string | undefined>): {
  name: string | null;
  apiKey: string | null;
} {
  const raw = env.EMAIL_PROVIDER;
  if (!raw || raw === '{}' || raw === '') return { name: null, apiKey: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('[analytics-report] EMAIL_PROVIDER must be a valid single-line JSON object');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const name = typeof obj.NAME === 'string' && obj.NAME ? obj.NAME.toLowerCase() : null;
  const apiKey = typeof obj.API_KEY === 'string' && obj.API_KEY ? obj.API_KEY : null;
  if (name && !['resend', 'dummy'].includes(name)) {
    throw new Error(`[analytics-report] EMAIL_PROVIDER.NAME must be "resend" or "dummy" (got "${name}")`);
  }
  return { name, apiKey };
}

export function getAnalyticsReportDeps(env: Record<string, string | undefined> = process.env): AnalyticsReportDeps {
  const kind = env.ANALYTICS_REPORT_STORAGE ?? 'dummy';

  // Fail closed (the AUTH_ALLOW_DUMMY guard — one opt-in covers every Lambda).
  const inLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (inLambda && env.AUTH_ALLOW_DUMMY !== '1') {
    if (kind === 'dummy') {
      throw new Error(
        '[analytics-report] refusing dummy storage inside AWS Lambda — set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
    if (env.NODE_ENV === 'test') {
      throw new Error(
        '[analytics-report] refusing NODE_ENV=test inside AWS Lambda — test-mode env must not leak into production; set AUTH_ALLOW_DUMMY=1 explicitly only for non-production testing'
      );
    }
  }

  let storage: AnalyticsReportStorage;
  if (kind === 'dummy') {
    storage = new InMemoryAnalyticsReportStorage(getSharedDummyUniverse());
  } else if (kind === 'dynamodb') {
    const documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AUTH_DYNAMODB_REGION ?? env.AWS_REGION ?? 'ap-east-1' }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    storage = new DynamoAnalyticsReportStorage(documentClient, requiredEnv(env, 'ANALYTICS_TABLE'));
  } else {
    throw new Error(`[analytics-report] ANALYTICS_REPORT_STORAGE must be "dummy" or "dynamodb" (got "${kind}")`);
  }

  const provider = parseEmailProvider(env);
  let sender: ReportEmailSender;
  if (provider.name === null || provider.name === 'dummy') {
    // No provider configured (or explicit dummy) — the handler reports the
    // report as unsent rather than crashing; in production the terraform
    // wiring always sets EMAIL_PROVIDER.
    sender = new DummyReportSender();
  } else {
    if (!provider.apiKey) {
      throw new Error('[analytics-report] EMAIL_PROVIDER.API_KEY is required when NAME is "resend"');
    }
    sender = new ResendReportSender(provider.apiKey, env.SES_FROM_ADDRESS ?? 'noreply@octavlearning.com');
  }

  // Production safety: the real AWS wiring MUST deliver via Resend — a no-op
  // sender in dynamodb mode would silently "send" the report and the admin
  // would never see it (the auth deps' EMAIL_PROVIDER guard, same class).
  if (kind === 'dynamodb' && !(sender instanceof ResendReportSender)) {
    throw new Error('[analytics-report] EMAIL_PROVIDER.NAME must be "resend" when using the real AWS wiring');
  }

  return {
    storage,
    sender,
    recipients: parseRecipients(env.ANALYTICS_ADMIN_EMAILS),
    host: env.ANALYTICS_REPORT_HOST ?? ANALYTICS_REPORT_DEFAULT_HOST,
  };
}
