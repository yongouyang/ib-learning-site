import { handleAnalyticsSummary } from '@/lib/analytics/http-handler';

// Dev/e2e path for GET /api/analytics/summary; production is the Lambda behind
// the CloudFront /api/analytics/* behavior (A6). Logic lives in src/lib/analytics/http-handler.ts.
export async function GET(req: Request) {
  return handleAnalyticsSummary(req);
}
