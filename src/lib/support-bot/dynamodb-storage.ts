import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { AnalyticsAggregateItem } from '../analytics/types';
import type { ContactMessage } from '../contact/types';
import type { Alert, SupportBotStorage } from './types';

// Production support-bot adapter (docs/support-bot-plan.md §4/§7): the
// SupportBotStorage contract across three tables — octav-support-alerts
// (alert create/dedup), octav-contact (read-only new-message poll) and
// octav-analytics-events (read-only aggregate poll). The bot has NO write
// access to the source tables (§7 IAM).
//
// IAM NOTE for S5 (deviation from plan §7's table): §7 grants Query on
// octav-contact, but that table has NO GSI (PK messageId only — terraform/
// modules/dynamodb), so the new-message poll is a filtered SCAN. S5 must
// grant dynamodb:Scan on octav-contact (volume is a handful of messages a
// day, so the Scan is trivially cheap).

interface TableNames {
  alerts: string;
  contact: string;
  analytics: string;
}

function isConditionalFailure(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export class DynamoSupportBotStorage implements SupportBotStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: TableNames
  ) {}

  // --- Alerts (octav-support-alerts) -------------------------------------------

  async getAlert(alertId: string): Promise<Alert | null> {
    // The §7 dedup check — alertId === dedupKey (see the types.ts design note).
    const res = await this.client.send(
      new GetCommand({ TableName: this.tables.alerts, Key: { alertId } })
    );
    return (res.Item as Alert | undefined) ?? null;
  }

  async putAlert(alert: Alert): Promise<boolean> {
    // Conditional create/re-open (§4/§11): a fresh alert requires absence; a
    // re-open requires the existing row to be resolved. Concurrent
    // invocations: exactly one write wins, the loser gets false.
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tables.alerts,
          Item: { ...alert },
          ConditionExpression: 'attribute_not_exists(alertId) OR #status = :resolved',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':resolved': 'resolved' },
        })
      );
      return true;
    } catch (err) {
      if (isConditionalFailure(err)) return false;
      throw err;
    }
  }

  async probeSupportAlertsTable(): Promise<void> {
    // CI smoke: GetItem on a key that never exists. Void = the table AND the
    // IAM grant work; AccessDenied/ResourceNotFound throws.
    await this.client.send(
      new GetCommand({
        TableName: this.tables.alerts,
        Key: { alertId: '__health_probe_nonexistent__' },
      })
    );
  }

  // --- Source polls (READ-ONLY) --------------------------------------------------

  async listNewContactMessages(): Promise<ContactMessage[]> {
    // octav-contact has no GSI — a filtered Scan is the only read (see the
    // header note). Loops LastEvaluatedKey so the poll NEVER truncates (the
    // listProgressByUser lesson).
    const items: ContactMessage[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new ScanCommand({
          TableName: this.tables.contact,
          FilterExpression: '#st = :new',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: { ':new': 'new' },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      items.push(...((res.Items ?? []) as ContactMessage[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  async getAggregatesBetween(
    fromDate: string,
    toDate: string
  ): Promise<Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>> {
    // The SAME aggregate BETWEEN query the analytics-report adapter issues:
    // "#" is the lowest printable delimiter and "~" sorts after any printable
    // key character, so `<fromDate>#` / `<toDate>#~` bracket exactly the
    // window's sort keys. Loops LastEvaluatedKey.
    const items: AnalyticsAggregateItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tables.analytics,
          KeyConditionExpression: 'k = :k AND s BETWEEN :from AND :to',
          ExpressionAttributeValues: { ':k': 'agg', ':from': `${fromDate}#`, ':to': `${toDate}#~` },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      items.push(...((res.Items ?? []) as AnalyticsAggregateItem[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return items.map(({ s, count }) => ({ s, count }));
  }
}
