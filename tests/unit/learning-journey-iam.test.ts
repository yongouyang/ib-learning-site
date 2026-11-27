import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function statementAfter(tf: string, marker: string): string {
  const markerIndex = tf.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const open = tf.indexOf('statement {', markerIndex);
  const close = tf.indexOf('\n  }', open);
  expect(open).toBeGreaterThan(markerIndex);
  expect(close).toBeGreaterThan(open);
  return tf.slice(open, close + 4);
}

const analytics = readFileSync(path.join(process.cwd(), 'terraform/modules/analytics_api/main.tf'), 'utf8');
const auth = readFileSync(path.join(process.cwd(), 'terraform/modules/auth_api/main.tf'), 'utf8');
const dynamodb = readFileSync(path.join(process.cwd(), 'terraform/modules/dynamodb/main.tf'), 'utf8');
const production = readFileSync(path.join(process.cwd(), 'terraform/envs/prod/main.tf'), 'utf8');

describe('learning journey table and least-privilege IAM', () => {
  it('gives analytics ingest Put + health Query only', () => {
    const statement = statementAfter(analytics, '# Opted-in journey events');
    expect(statement).toContain('"dynamodb:PutItem"');
    expect(statement).toContain('"dynamodb:Query"');
    expect(statement).toContain('var.learning_journey_events_table_arn');
    expect(statement).not.toContain('"dynamodb:DeleteItem"');
    expect(statement).not.toContain('"dynamodb:UpdateItem"');
    expect(statement).not.toContain('"dynamodb:GetItem"');
  });

  it('gives auth export/erasure Query + Delete only', () => {
    const statement = statementAfter(auth, '# Learning journey export and erasure');
    expect(statement).toContain('"dynamodb:Query"');
    expect(statement).toContain('"dynamodb:DeleteItem"');
    expect(statement).toContain('var.learning_journey_events_table_arn');
    expect(statement).not.toContain('"dynamodb:PutItem"');
    expect(statement).not.toContain('"dynamodb:UpdateItem"');
    expect(statement).not.toContain('"dynamodb:GetItem"');
  });

  it('uses per-user keys, TTL, deletion protection and PITR', () => {
    const start = dynamodb.indexOf('resource "aws_dynamodb_table" "learning_journey_events"');
    const end = dynamodb.indexOf('# --- octav-leaderboard', start);
    const table = dynamodb.slice(start, end);
    expect(table).toContain('hash_key     = "userId"');
    expect(table).toContain('range_key    = "eventKey"');
    expect(table).toContain('deletion_protection_enabled = true');
    expect(table).toMatch(/point_in_time_recovery\s*\{\s*enabled = true/);
    expect(table).toMatch(/ttl\s*\{\s*attribute_name = "expiresAt"\s*enabled\s*= true/);
  });

  it('wires the same table into analytics and auth production environments', () => {
    expect(production).toContain('learning_journey_events_table_arn = module.dynamodb.learning_journey_events_table_arn');
    expect(production.match(/LEARNING_JOURNEY_TABLE = module\.dynamodb\.learning_journey_events_table_name/g)).toHaveLength(2);
  });
});
