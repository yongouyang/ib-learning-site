import { handleProgressGet } from '@/lib/progress/http-handler';

// Dev/e2e path for GET /api/progress; production is the Lambda behind the
// CloudFront /api/progress/* behavior. Logic lives in src/lib/progress/http-handler.ts.
export async function GET(req: Request) {
  return handleProgressGet(req);
}
