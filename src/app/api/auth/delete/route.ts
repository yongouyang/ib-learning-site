import { handleDeleteAccount } from '@/lib/auth/http-handler';

// Dev/e2e path for POST /api/auth/delete (right to erasure, plan §9 Q8);
// production is the Lambda behind the CloudFront /api/auth/* behavior.
export async function POST(req: Request) {
  return handleDeleteAccount(req);
}
