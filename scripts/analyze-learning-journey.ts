import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoLearningJourneyStorage } from '../src/lib/analytics/journey-dynamodb';
import { buildLearningJourneyReport } from '../src/lib/analytics/journey';
import { utcDate } from '../src/lib/analytics/types';
import type { UserRecord } from '../src/lib/auth/types';

function argument(name: string, fallback = ''): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main(): Promise<void> {
  const email = argument('user').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('--user=<email> is required');
  const days = Number(argument('days', '30'));
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('--days must be an integer from 1 to 90');
  const host = argument('host', 'octavlearning.com');
  const includeTest = process.argv.includes('--include-test');
  const now = Date.now();
  const from = `${utcDate(now - (days - 1) * 86_400_000)}T00:00:00.000Z`;
  const to = `${new Date(now).toISOString()}${String.fromCharCode(0xffff)}`;

  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'ap-east-1',
  }));
  const userResult = await documentClient.send(new QueryCommand({
    TableName: process.env.AUTH_USERS_TABLE ?? 'octav-users',
    IndexName: 'GSI1',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email },
    Limit: 1,
  }));
  const user = userResult.Items?.[0] as UserRecord | undefined;
  if (!user) throw new Error('No account found for that email');

  const storage = new DynamoLearningJourneyStorage(
    documentClient,
    process.env.LEARNING_JOURNEY_TABLE ?? 'octav-learning-journey-events'
  );
  const events = (await storage.listJourneyEventsByUser(user.userId, { from, to }))
    .filter((event) => event.host === host);
  const report = buildLearningJourneyReport(events, includeTest);

  console.log(JSON.stringify({
    account: {
      userId: user.userId,
      email: user.email,
      journeyAnalyticsOptIn: user.journeyAnalyticsOptIn === true,
    },
    window: { days, from, to: new Date(now).toISOString(), host },
    note: 'Only explicitly opted-in accounts have journey events. Missing events mean unknown activity, not abandonment. Automation is excluded by default (--include-test overrides).',
    excludedTestEvents: includeTest ? 0 : events.filter((event) => event.test === true).length,
    ...report,
  }, null, 2));
}

void main();
