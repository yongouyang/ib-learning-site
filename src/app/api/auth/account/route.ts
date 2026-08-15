import { handleAccountPost } from '@/lib/auth/http-handler';

// Dev/e2e path for POST /api/auth/account; production is the Lambda behind
// the CloudFront /api/auth/* behavior. Logic lives in src/lib/auth/http-handler.ts.
// POST (not PATCH) by design: §2.5 keeps every state change on POST so
// CloudFront always forwards the JSON body.
export async function POST(req: Request) {
  return handleAccountPost(req);
}
