import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guards for the Phase 1b content API wiring (the contact-iam / leaderboard-iam precedent):
// plain-text assertions on the .tf and the handler, so a regression fails in CI without AWS.
//
// The stakes here are higher than a normal IAM pin. Two invariants decide whether paid content stays
// paid (docs/premium-content-protection-plan.md §6.1):
//   1. the premium response can never share the public route's cache policy — CloudFront would then
//      serve mark schemes to anonymous viewers FROM CACHE;
//   2. the premium route is gated by a resolved SESSION plus exam-sets-full, server-side.
// Both are asserted below, along with the smallest IAM grant set in the repo (the content itself is
// bundled, so there is no content table to grant).

function statementAfter(tf: string, marker: string): string {
  const markerIdx = tf.indexOf(marker);
  expect(markerIdx).toBeGreaterThanOrEqual(0);
  const open = tf.indexOf('statement {', markerIdx);
  expect(open).toBeGreaterThan(markerIdx);
  const CLOSE = '\n  }';
  const close = tf.indexOf(CLOSE, open + 1);
  expect(close).toBeGreaterThan(open);
  return tf.slice(open, close + CLOSE.length);
}

const contentTf = readFileSync(path.join(process.cwd(), 'terraform/modules/content_api/main.tf'), 'utf8');
const siteTf = readFileSync(path.join(process.cwd(), 'terraform/modules/site/main.tf'), 'utf8');
const prodTf = readFileSync(path.join(process.cwd(), 'terraform/envs/prod/main.tf'), 'utf8');
const handlerTs = readFileSync(path.join(process.cwd(), 'src/lib/content/http-handler.ts'), 'utf8');
const contentTypesTs = readFileSync(path.join(process.cwd(), 'src/lib/content/types.ts'), 'utf8');

describe('content Lambda IAM policy (static) — least-privilege', () => {
  it('carries the session-validation grant set (users GetItem; sessions Get/Update/Delete)', () => {
    const users = statementAfter(contentTf, '# users — resolveSession');
    expect(users).toContain('"dynamodb:GetItem"');
    expect(users).toContain('var.users_table_arn');
    expect(users).not.toContain('"dynamodb:Query"');

    const sessions = statementAfter(contentTf, '# sessions — resolveSession');
    expect(sessions).toContain('"dynamodb:GetItem"');
    expect(sessions).toContain('"dynamodb:UpdateItem"');
    expect(sessions).toContain('"dynamodb:DeleteItem"');
    expect(sessions).toContain('var.sessions_table_arn');
    expect(sessions).not.toContain('"dynamodb:Query"');
  });

  it('grants ONLY UpdateItem on octav-rate-limits (the public route budget)', () => {
    const rl = statementAfter(contentTf, '# rate limits — incrementContentRequestCount');
    expect(rl).toContain('"dynamodb:UpdateItem"');
    expect(rl).toContain('var.rate_limits_table_arn');
    expect(rl).not.toContain('"dynamodb:GetItem"');
    expect(rl).not.toContain('"dynamodb:PutItem"');
    expect(rl).not.toContain('"dynamodb:DeleteItem"');
  });

  it('owns NO content table and no SES grant — the content is bundled into the function', () => {
    // No content table at all: no ARN variable, no table-name variable, and no write grant that a
    // table would need (the word appears only in the explanatory comment, hence the precise patterns).
    expect(contentTf).not.toContain('variable "content_table_arn"');
    expect(contentTf).not.toContain('content_table_name');
    expect(contentTf).not.toContain('"dynamodb:PutItem"');
    expect(contentTf).not.toContain('ses:SendEmail');
    // …and the data policy is exactly three statements: users, sessions, rate limits.
    const dataPolicy = contentTf.slice(
      contentTf.indexOf('data "aws_iam_policy_document" "content"'),
      contentTf.indexOf('resource "aws_iam_role_policy" "content"')
    );
    expect(dataPolicy.match(/statement \{/g)).toHaveLength(3);
  });
});

describe('CloudFront cache policies — the premium/public separation', () => {
  it('has three /api/content behaviors, ordered premium → public → catch-all', () => {
    const premium = siteTf.indexOf('path_pattern             = "/api/content/premium/*"');
    const publicRoute = siteTf.indexOf('path_pattern             = "/api/content/public/*"');
    const catchAll = siteTf.indexOf('path_pattern             = "/api/content/*"');
    expect(premium).toBeGreaterThanOrEqual(0);
    expect(publicRoute).toBeGreaterThan(premium);
    expect(catchAll).toBeGreaterThan(publicRoute);
  });

  it('NEVER caches the premium prefix and caches only the public prefix', () => {
    const premiumBehavior = siteTf.slice(siteTf.indexOf('"/api/content/premium/*"') - 400, siteTf.indexOf('"/api/content/public/*"'));
    expect(premiumBehavior).toContain('local.cache_policy_caching_disabled');
    expect(premiumBehavior).not.toContain('local.cache_policy_caching_optimized');

    const publicBehavior = siteTf.slice(
      siteTf.indexOf('"/api/content/public/*"'),
      siteTf.indexOf('"/api/content/*"')
    );
    expect(publicBehavior).toContain('local.cache_policy_caching_optimized');

    const catchAllBehavior = siteTf.slice(siteTf.indexOf('"/api/content/*"'));
    expect(catchAllBehavior).toContain('local.cache_policy_caching_disabled');
  });

  it('is wired in both environments (dev + prod site instances)', () => {
    expect(prodTf.match(/content_origin_domain\s+= module\.content_api\.function_url_domain/g)).toHaveLength(2);
    expect(prodTf).toContain('module "content_api"');
    // Real wiring, never the dummy: dummy storage is refused inside Lambda.
    expect(prodTf).toContain('CONTENT_STORAGE        = "dynamodb"');
  });
});

describe('the premium route is gated server-side, not in the UI', () => {
  it('requires a resolved session before the entitlement check', () => {
    const session = handlerTs.indexOf('resolveSession(req, deps.storage)');
    const entitlement = handlerTs.indexOf("includes('exam-sets-full')");
    expect(session).toBeGreaterThanOrEqual(0);
    expect(entitlement).toBeGreaterThan(session);
  });

  it('sets an explicit cache policy on every response and never a shared default', () => {
    // The premium path must be private/no-store; the public path may be cached. If a future edit
    // drops the explicit header, the browser (and any proxy) would be free to cache a mark scheme.
    expect(contentTypesTs).toContain("CONTENT_PRIVATE_CACHE_CONTROL = 'private, no-store'");
    expect(contentTypesTs).toContain('CONTENT_PUBLIC_CACHE_CONTROL');
    // …and the premium handler uses the private policy, the public one the cacheable policy.
    expect(handlerTs).toContain('CONTENT_PRIVATE_CACHE_CONTROL');
    expect(handlerTs).toContain('CONTENT_PUBLIC_CACHE_CONTROL');
    expect(handlerTs).toContain('cacheControl: string');
  });
});
