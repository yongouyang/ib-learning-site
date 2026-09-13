import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guards for the E4.2 subscriptions IAM wiring (the contact-iam /
// leaderboard-iam / progress-iam precedent): plain-text assertions on the .tf so
// a grant regression fails in CI without AWS. modules/subscriptions_api is
// deliberately the SMALLEST policy in the repo — it is the only non-auth Lambda
// that can move a user's tier, so the writes it may perform deserve pinning.

function statementAfter(tf: string, marker: string): string {
  const markerIdx = tf.indexOf(marker);
  expect(markerIdx).toBeGreaterThanOrEqual(0);
  const open = tf.indexOf('statement {', markerIdx);
  expect(open).toBeGreaterThan(markerIdx);
  // The block's own closing brace sits at 2-space indent (see progress-iam).
  const CLOSE = '\n  }';
  const close = tf.indexOf(CLOSE, open + 1);
  expect(close).toBeGreaterThan(open);
  return tf.slice(open, close + CLOSE.length);
}

const subsTf = readFileSync(path.join(process.cwd(), 'terraform/modules/subscriptions_api/main.tf'), 'utf8');

describe('subscriptions Lambda IAM policy (static) — least-privilege', () => {
  it('may write the user row (tier + billing state) but never create or delete a user', () => {
    const users = statementAfter(subsTf, '# users — resolveSession reads the user row');
    expect(users).toContain('"dynamodb:GetItem"');
    // UpdateItem is the §6.3 billing write — and the only way any non-auth
    // Lambda can move `tier`, which is the entitlement source of truth.
    expect(users).toContain('"dynamodb:UpdateItem"');
    expect(users).toContain('var.users_table_arn');
    // No PutItem (account creation is the auth Lambda's job), no DeleteItem
    // (erasure likewise), and no Query (the adapter never touches a GSI — the
    // account model is one item per user).
    expect(users).not.toContain('"dynamodb:PutItem"');
    expect(users).not.toContain('"dynamodb:DeleteItem"');
    expect(users).not.toContain('"dynamodb:Query"');
    expect(users).not.toContain('"dynamodb:Scan"');
  });

  it('carries the shared session-validation grant set', () => {
    const sessions = statementAfter(subsTf, '# sessions — resolveSession');
    expect(sessions).toContain('"dynamodb:GetItem"');
    expect(sessions).toContain('"dynamodb:UpdateItem"');
    expect(sessions).toContain('"dynamodb:DeleteItem"');
    expect(sessions).toContain('var.sessions_table_arn');
    expect(sessions).not.toContain('"dynamodb:Query"');
  });

  it('holds BOTH rate-limits writes: the webhook ledger PutItem and the budget UpdateItem', () => {
    const rl = statementAfter(subsTf, '# rate limits — TWO different writes');
    expect(rl).toContain('"dynamodb:PutItem"');
    expect(rl).toContain('"dynamodb:UpdateItem"');
    expect(rl).toContain('var.rate_limits_table_arn');
    // The ledger's condition is what makes a Stripe retry a no-op, so it must
    // stay a conditional Put — and there is nothing to read back (the handler
    // re-reads the subscription from Stripe, not the ledger).
    expect(rl).not.toContain('"dynamodb:GetItem"');
    expect(rl).not.toContain('"dynamodb:DeleteItem"');
    expect(rl).not.toContain('"dynamodb:Query"');
  });

  it('has no SES grant and no Stripe-side secret in the clear', () => {
    expect(subsTf).not.toContain('ses:SendEmail');
    expect(subsTf).not.toContain('ses:SendRawEmail');
    // Key material only ever arrives through var.environment (sensitive).
    expect(subsTf).not.toMatch(/sk_test_|sk_live_|whsec_/);
  });

  it('pins the wiring that makes the Lambda runnable at all', () => {
    const envTf = readFileSync(path.join(process.cwd(), 'terraform/envs/prod/main.tf'), 'utf8');
    // dummy storage/stripe is REFUSED inside AWS Lambda (deps.ts) — both of
    // these being real is what stops every request throwing at construction.
    expect(envTf).toContain('SUBSCRIPTIONS_STORAGE  = "dynamodb"');
    expect(envTf).toMatch(/STRIPE_MODE\s+= "test"/); // capability: prod still resolves live first
    expect(envTf).toContain('STRIPE_ENV             = var.stripe_env');
    // The ledger + budget + tier write all name real tables.
    expect(envTf).toContain('AUTH_RATE_LIMITS_TABLE = module.dynamodb.rate_limits_table_name');
    expect(envTf).toContain('AUTH_USERS_TABLE       = module.dynamodb.users_table_name');
  });

  it('wires BOTH CloudFront behaviours before /api/* (the webhook posts the bare path)', () => {
    const siteTf = readFileSync(path.join(process.cwd(), 'terraform/modules/site/main.tf'), 'utf8');
    const exact = siteTf.indexOf('path_pattern             = "/api/subscriptions"');
    const wildcard = siteTf.indexOf('path_pattern             = "/api/subscriptions/*"');
    const fallback = siteTf.indexOf('path_pattern             = "/api/*"');
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(wildcard).toBeGreaterThan(exact);
    // Ordered behaviors match top-down: /api/* must stay LAST, or every
    // billing call (and every Stripe delivery) would hit the feedback Lambda.
    expect(fallback).toBeGreaterThan(wildcard);
  });
});
