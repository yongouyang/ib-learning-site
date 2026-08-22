import { handleAnalyticsEvent } from '@/lib/analytics/http-handler';

// Dev/e2e path for POST /api/analytics/event; production is the Lambda behind
// the CloudFront /api/analytics/* behavior (A6). Logic lives in src/lib/analytics/http-handler.ts.
export async function POST(req: Request) {
  return handleAnalyticsEvent(req);
}
