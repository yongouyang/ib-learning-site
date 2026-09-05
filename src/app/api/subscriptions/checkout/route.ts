import { handleCheckoutPost } from '@/lib/subscriptions/http-handler';

// Dev/e2e path for POST /api/subscriptions/checkout (E4.2); production is the
// octav-subscriptions Lambda behind the CloudFront /api/subscriptions/*
// behaviour. Logic lives in src/lib/subscriptions/http-handler.ts.
export async function POST(req: Request) {
  return handleCheckoutPost(req);
}
