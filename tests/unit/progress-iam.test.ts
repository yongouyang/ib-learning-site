import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guard for the progress Lambda's least-privilege data policy
// (terraform/modules/progress_api/main.tf). Round 2: the users-table statement
// must grant GetItem ONLY — nothing in the progress path queries the users
// table (getUserByEmail is auth-only), so Query + index/* were removed. These
// are plain-text assertions so the regression fails in CI the moment the .tf
// drifts, without AWS.

const tf = readFileSync(path.join(process.cwd(), 'terraform/modules/progress_api/main.tf'), 'utf8');

/** The text of one `statement { ... }` block whose preceding comment contains `marker`. */
function statementAfter(marker: string): string {
  const markerIdx = tf.indexOf(marker);
  expect(markerIdx).toBeGreaterThanOrEqual(0);
  const open = tf.indexOf('statement {', markerIdx);
  expect(open).toBeGreaterThan(markerIdx);
  // The block's own closing brace sits at 2-space indent (`\n  }`) — inner
  // brackets close at 4 spaces and `${...}` interpolations contain bare '}',
  // so anchor on the indented form to avoid cutting the slice early.
  const CLOSE = '\n  }';
  const close = tf.indexOf(CLOSE, open + 1);
  expect(close).toBeGreaterThan(open);
  return tf.slice(open, close + CLOSE.length);
}

describe('progress Lambda IAM policy (static)', () => {
  it('grants the users table GetItem only — no Query, no index/*', () => {
    const users = statementAfter('# users — session validation');
    expect(users).toContain('"dynamodb:GetItem"');
    expect(users).not.toContain('"dynamodb:Query"');
    expect(users).not.toContain('index/*');
    // The resource is the users table ARN alone.
    expect(users).toContain('var.users_table_arn');
  });

  it('grants the sessions table Get/Update/Delete — the TTL slide and orphan cleanup need them', () => {
    const sessions = statementAfter('# sessions — resolveSession');
    expect(sessions).toContain('"dynamodb:GetItem"');
    expect(sessions).toContain('"dynamodb:UpdateItem"');
    expect(sessions).toContain('"dynamodb:DeleteItem"');
    // No Query / index grants — the progress path never lists sessions.
    expect(sessions).not.toContain('"dynamodb:Query"');
    expect(sessions).not.toContain('index/*');
    expect(sessions).toContain('var.sessions_table_arn');
  });

  it('keeps Query + index/* on the progress table (listProgressByUser pages it)', () => {
    const progress = statementAfter('# progress — the single-table');
    expect(progress).toContain('"dynamodb:Query"');
    expect(progress).toContain('"${var.progress_table_arn}/index/*"');
    expect(progress).toContain('"dynamodb:GetItem"');
    expect(progress).toContain('"dynamodb:PutItem"');
    expect(progress).toContain('"dynamodb:UpdateItem"');
    expect(progress).toContain('"dynamodb:DeleteItem"');
  });
});
