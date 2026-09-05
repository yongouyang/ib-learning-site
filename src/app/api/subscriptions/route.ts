import { handleWebhookPost } from '@/lib/subscriptions/http-handler';

// Dev/e2e path for POST /api/subscriptions — the Stripe WEBHOOK receiver
// (E4.2, docs/stripe-subscriptions-plan.md §6.2). Production is the
// octav-subscriptions Lambda behind the CloudFront /api/subscriptions exact-path
// behaviour (the bare path matters: Stripe posts there, not to a sub-path).
// Logic lives in src/lib/subscriptions/http-handler.ts.
//
// The body must reach the handler as the EXACT bytes Stripe signed, so this
// route forwards the Request untouched — no JSON re-parsing here.
export async function POST(req: Request) {
  return handleWebhookPost(req);
}
