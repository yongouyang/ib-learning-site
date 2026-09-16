import { handleContentGet } from '@/lib/content/http-handler';

// Dev/e2e path for the whole content API (premium papers, public mixed review, _health); production
// is the content Lambda behind the CloudFront /api/content/* behaviors (Phase 1b,
// docs/premium-content-protection-plan.md §4). Logic lives in src/lib/content/http-handler.ts — the
// path parsing is shared, so both entry points route identically.
export async function GET(req: Request) {
  return handleContentGet(req);
}
