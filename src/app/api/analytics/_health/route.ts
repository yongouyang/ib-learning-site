import { handleAnalyticsHealth } from '@/lib/analytics/http-handler';

// Dev/e2e path for GET /api/analytics/_health (the CI smoke probe); production
// is the Lambda behind the CloudFront /api/analytics/* behavior (A6).
export async function GET(req: Request) {
  return handleAnalyticsHealth(req);
}
