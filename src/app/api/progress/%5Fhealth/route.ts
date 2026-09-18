import { handleProgressHealth } from '@/lib/progress/http-handler';

// Dev/e2e path for GET /api/progress/_health (the CI smoke probe); production
// is the Lambda behind the CloudFront /api/progress/* behavior.
export async function GET(req: Request) {
  return handleProgressHealth(req);
}
