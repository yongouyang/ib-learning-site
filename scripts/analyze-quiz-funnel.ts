import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { buildQuizFunnel, type FunnelEvent } from '../src/lib/analytics/funnel';
import { utcDate } from '../src/lib/analytics/types';

function argument(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main(): Promise<void> {
  const days = Number(argument('days', '7'));
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('--days must be an integer from 1 to 90');
  const host = argument('host', 'octavlearning.com');
  const now = Date.now();
  const from = `${utcDate(now - (days - 1) * 86_400_000)}#`;
  const to = `${utcDate(now)}#~`;
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-east-1' }));
  const events: FunnelEvent[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const response = await client.send(new QueryCommand({
      TableName: process.env.ANALYTICS_EVENTS_TABLE ?? 'octav-analytics-events',
      KeyConditionExpression: 'k = :kind AND s BETWEEN :from AND :to',
      FilterExpression: '#host = :host',
      ExpressionAttributeNames: { '#host': 'host' },
      ExpressionAttributeValues: { ':kind': 'ev', ':from': from, ':to': to, ':host': host },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    events.push(...((response.Items ?? []) as FunnelEvent[]));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  console.log(JSON.stringify({
    window: { days, from: from.slice(0, 10), to: to.slice(0, 10), host },
    note: 'Legacy attempts merge repeat quizzes for one tab and topic; startEvents exposes the old duplicate-start distortion.',
    ...buildQuizFunnel(events),
  }, null, 2));
}

void main();
