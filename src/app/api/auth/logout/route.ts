import { handleLogout } from '@/lib/auth/http-handler';

// Dev/e2e path for POST /api/auth/logout; production is the Lambda behind
// the CloudFront /api/auth/* behavior. Logic lives in src/lib/auth/http-handler.ts.
export async function POST(req: Request) {
  return handleLogout(req);
}
