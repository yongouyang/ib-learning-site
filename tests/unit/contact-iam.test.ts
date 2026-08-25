import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guards for the Feature 3 contact IAM wiring (the leaderboard-iam /
// progress-iam precedent): plain-text assertions on the .tf so a grant
// regression fails in CI without AWS. modules/contact_api is LEAST-PRIVILEGE:
// append-only writes + the health probe on octav-contact, the fixed-window
// budget on octav-rate-limits, and the shared resolveSession grant set on
// users/sessions — nothing else (no SES: notification email goes through
// Resend's HTTPS API).

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

const contactTf = readFileSync(path.join(process.cwd(), 'terraform/modules/contact_api/main.tf'), 'utf8');

describe('contact Lambda IAM policy (static) — least-privilege', () => {
  it('grants PutItem + GetItem on octav-contact and NO other write actions', () => {
    const contact = statementAfter(contactTf, '# contact — saveContactMessage');
    expect(contact).toContain('"dynamodb:PutItem"');
    // GetItem is the /api/contact/_health probe (fixed nonexistent key).
    expect(contact).toContain('"dynamodb:GetItem"');
    expect(contact).toContain('var.contact_table_arn');
    // Append-only: status transitions go through the admin Lambda (Feature 2),
    // not this function.
    expect(contact).not.toContain('"dynamodb:UpdateItem"');
    expect(contact).not.toContain('"dynamodb:DeleteItem"');
    expect(contact).not.toContain('"dynamodb:Query"');
    expect(contact).not.toContain('"dynamodb:Scan"');
  });

  it('grants ONLY UpdateItem on octav-rate-limits (the conditional fixed-window counter)', () => {
    const rl = statementAfter(contactTf, '# rate limits — incrementContactCount');
    expect(rl).toContain('"dynamodb:UpdateItem"');
    expect(rl).toContain('var.rate_limits_table_arn');
    // The condition evaluates the pre-update item — no GetItem needed (the
    // analytics precedent).
    expect(rl).not.toContain('"dynamodb:GetItem"');
    expect(rl).not.toContain('"dynamodb:PutItem"');
    expect(rl).not.toContain('"dynamodb:DeleteItem"');
  });

  it('carries the session-validation grant set (users GetItem; sessions Get/Update/Delete)', () => {
    const users = statementAfter(contactTf, '# users — session validation');
    expect(users).toContain('"dynamodb:GetItem"');
    expect(users).toContain('var.users_table_arn');
    expect(users).not.toContain('"dynamodb:Query"');

    // resolveSession slides the session TTL (UpdateItem) and deletes
    // expired/orphaned sessions (DeleteItem) — same grant set as
    // leaderboard_api/analytics_api (the contact storage delegates to the
    // shared DynamoSessionStorage).
    const sessions = statementAfter(contactTf, '# sessions — resolveSession');
    expect(sessions).toContain('"dynamodb:GetItem"');
    expect(sessions).toContain('"dynamodb:UpdateItem"');
    expect(sessions).toContain('"dynamodb:DeleteItem"');
    expect(sessions).toContain('var.sessions_table_arn');
    expect(sessions).not.toContain('"dynamodb:Query"');
  });

  it('has no SES grant (notification email goes through Resend HTTPS)', () => {
    expect(contactTf).not.toContain('ses:SendEmail');
    expect(contactTf).not.toContain('ses:SendRawEmail');
  });
});
