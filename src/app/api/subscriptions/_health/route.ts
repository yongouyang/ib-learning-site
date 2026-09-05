import { handleSubscriptionsHealth } from '@/lib/subscriptions/http-handler';

// Dev/e2e path for GET /api/subscriptions/_health — the unauthenticated CI
// smoke probe (E4.2). Production is the octav-subscriptions Lambda behind the
// CloudFront /api/subscriptions/* behaviour.
export async function GET(req: Request) {
  return handleSubscriptionsHealth(req);
}
