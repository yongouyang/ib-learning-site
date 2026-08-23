import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Static guards for the Phase D leaderboard IAM wiring (the progress-iam
// precedent): plain-text assertions on the .tf so a grant regression fails in
// CI without AWS. Two modules:
// - modules/leaderboard_api: the board Lambda is READ-ONLY on
//   octav-leaderboard (plan §6 single-writer invariant — writes come from the
//   progress Lambda, deletes from the auth Lambda).
// - modules/auth_api: the erasure grant (opt-out + account deletion) is Query
//   on the user-index GSI + DeleteItem on the table — nothing more.

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

const leaderboardTf = readFileSync(path.join(process.cwd(), 'terraform/modules/leaderboard_api/main.tf'), 'utf8');
const authTf = readFileSync(path.join(process.cwd(), 'terraform/modules/auth_api/main.tf'), 'utf8');

describe('leaderboard Lambda IAM policy (static) — read-only board access', () => {
  it('grants Query + GetItem on octav-leaderboard and NO write actions', () => {
    const lb = statementAfter(leaderboardTf, '# leaderboard — READ-ONLY');
    expect(lb).toContain('"dynamodb:Query"');
    expect(lb).toContain('"dynamodb:GetItem"');
    expect(lb).toContain('var.leaderboard_table_arn');
    // Single-writer invariant: no XP writes (progress Lambda), no erasure
    // deletes (auth Lambda), and no user-index GSI reads.
    expect(lb).not.toContain('"dynamodb:PutItem"');
    expect(lb).not.toContain('"dynamodb:UpdateItem"');
    expect(lb).not.toContain('"dynamodb:DeleteItem"');
    expect(lb).not.toContain('index/*');
  });

  it('carries the session-validation grant set (users GetItem; sessions Get/Update/Delete)', () => {
    const users = statementAfter(leaderboardTf, '# users — session validation');
    expect(users).toContain('"dynamodb:GetItem"');
    expect(users).not.toContain('"dynamodb:Query"');

    const sessions = statementAfter(leaderboardTf, '# sessions — resolveSession');
    expect(sessions).toContain('"dynamodb:GetItem"');
    expect(sessions).toContain('"dynamodb:UpdateItem"');
    expect(sessions).toContain('"dynamodb:DeleteItem"');
  });
});

describe('auth Lambda IAM policy (static) — leaderboard erasure grant', () => {
  it('grants Query on the user-index GSI and DeleteItem on the table (one pair, two callers)', () => {
    const gsi = statementAfter(authTf, '# leaderboard — Phase D erasure');
    expect(gsi).toContain('"dynamodb:Query"');
    expect(gsi).toContain('"${var.leaderboard_table_arn}/index/*"');
    // The GSI statement must not leak table-level or write access.
    expect(gsi).not.toContain('"dynamodb:DeleteItem"');
    expect(gsi).not.toContain('var.leaderboard_table_arn\,');

    // The DeleteItem statement follows the GSI statement in the same comment
    // block (account deletion + D5 opt-out share it — plan §6/§7).
    const del = statementAfter(authTf, '"${var.leaderboard_table_arn}/index/*"');
    expect(del).toContain('"dynamodb:DeleteItem"');
    expect(del).toContain('var.leaderboard_table_arn');
    expect(del).not.toContain('"dynamodb:Query"');
    expect(del).not.toContain('"dynamodb:UpdateItem"');
  });
});
