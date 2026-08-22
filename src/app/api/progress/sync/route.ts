import { handleProgressSync } from '@/lib/progress/http-handler';

// Dev/e2e path for POST /api/progress/sync; production is the Lambda behind
// the CloudFront /api/progress/* behavior. Logic lives in src/lib/progress/http-handler.ts.
export async function POST(req: Request) {
  return handleProgressSync(req);
}
