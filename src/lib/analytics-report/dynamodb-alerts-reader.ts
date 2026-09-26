import { QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Alert } from '../support-bot/types';
import { UNRESOLVED_ALERT_STATUSES, type OpenAlertsReader } from './types';

// Production open-alerts reader (docs/support-bot-plan.md §9 Q9, S6): the
// daily analytics report's "Open Alerts" section reads octav-support-alerts
// through the GSI1 (status → createdAt) index — one newest-first Query per
// unresolved status, LastEvaluatedKey looped so the severity counts NEVER
// truncate (the listProgressByUser lesson). Read-only; the report has no
// write access to the alerts table (the S5 IAM grant is Query on the GSI).
// The raw rows go to the PURE buildOpenAlertsSummary, which does the math.

export class DynamoOpenAlertsReader implements OpenAlertsReader {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async listUnresolvedAlerts(): Promise<Array<Pick<Alert, 'severity' | 'title' | 'status' | 'createdAt'>>> {
    const items: Alert[] = [];
    for (const status of UNRESOLVED_ALERT_STATUSES) {
      let lastKey: Record<string, unknown> | undefined;
      do {
        const res = await this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI1',
            KeyConditionExpression: '#st = :status',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':status': status },
            ScanIndexForward: false, // newest createdAt first
            ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
          })
        );
        items.push(...((res.Items ?? []) as Alert[]));
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
    }
    return items.map(({ severity, title, status, createdAt }) => ({ severity, title, status, createdAt }));
  }
}
