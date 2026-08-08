import { handleFeedbackGet, handleFeedbackPost } from '@/lib/feedback/http-handler';

// Phase 5 — AI feedback route (dev/e2e path; production is the Lambda behind
// the CloudFront /api/* behavior, see aws-deployment-plan.md §5). Logic lives
// in src/lib/feedback/http-handler.ts — shared 1:1 with the Lambda. Key is
// server-side only (FEEDBACK_API_KEY, never NEXT_PUBLIC_).

export async function GET() {
  return handleFeedbackGet();
}

export async function POST(req: Request) {
  return handleFeedbackPost(req);
}
