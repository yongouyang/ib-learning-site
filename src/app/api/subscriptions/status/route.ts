import { handleStatusGet } from '@/lib/subscriptions/http-handler';

// Dev/e2e path for GET /api/subscriptions/status (E4.2); production is the
// octav-subscriptions Lambda behind the CloudFront /api/subscriptions/*
// behaviour. Logic lives in src/lib/subscriptions/http-handler.ts.
export async function GET(req: Request) {
  return handleStatusGet(req);
}
