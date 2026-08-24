import { QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AnalyticsAggregateItem } from '../analytics/types';
import type { AnalyticsReportStorage } from './types';

// Production adapter for the daily analytics report: the aggregate BETWEEN
// query on octav-analytics-events (PK `k` = "agg", SK `s` date-prefixed) — the
// same query the dashboard's getSummary issues, but over an arbitrary
// [fromDate, toDate] window (the report's 24h) instead of a whole-number
// days window. Loops LastEvaluatedKey so the fold NEVER truncates (the
// listProgressByUser lesson) — the raw rows are handed to the PURE buildReport
// (src/lib/analytics-report/types.ts), which does all the math.

export class DynamoAnalyticsReportStorage implements AnalyticsReportStorage {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async getAggregatesBetween(fromDate: string, toDate: string): Promise<Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>> {
    // "#" is the lowest printable delimiter and "~" sorts after any printable
    // key character, so `<fromDate>#` / `<toDate>#~` bracket exactly the
    // window's sort keys (same trick as getSummary).
    const items: AnalyticsAggregateItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
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
