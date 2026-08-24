import { InMemoryAnalyticsStorage } from '../analytics/dummy';
import type { AnalyticsAggregateItem } from '../analytics/types';
import type { AnalyticsReportStorage } from './types';

// In-memory report storage — the controllable-dummy directive (AGENTS.md):
// dev and e2e run with zero AWS resources. It WRAPS the shared analytics
// dummy (the ONE in-memory universe that auth/progress/analytics/feedback/
// leaderboard share via src/lib/progress/deps.ts) and reads its aggregate map
// through the getAggregatesBetween method added to InMemoryAnalyticsStorage —
// so a report generated in dev sees exactly the events the ingest endpoint
// recorded, mirroring how the report Lambda reads the same DynamoDB table the
// analytics Lambda writes.

export class InMemoryAnalyticsReportStorage implements AnalyticsReportStorage {
  constructor(private readonly universe: InMemoryAnalyticsStorage) {}

  async getAggregatesBetween(fromDate: string, toDate: string): Promise<Array<Pick<AnalyticsAggregateItem, 's' | 'count'>>> {
    return this.universe.getAggregatesBetween(fromDate, toDate);
  }
}
