import { handleRevokeSession } from '@/lib/auth/http-handler';

// Dev/e2e path for POST /api/auth/sessions/revoke; production is the Lambda
// behind the CloudFront /api/auth/* behavior. Logic lives in src/lib/auth/http-handler.ts.
export async function POST(req: Request) {
  return handleRevokeSession(req);
}
