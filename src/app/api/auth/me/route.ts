import { handleMe } from '@/lib/auth/http-handler';

// Dev/e2e path for GET /api/auth/me; production is the Lambda behind
// the CloudFront /api/auth/* behavior. Logic lives in src/lib/auth/http-handler.ts.
export async function GET(req: Request) {
  return handleMe(req);
}
