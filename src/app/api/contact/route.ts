import { handleContactPost } from '@/lib/contact/http-handler';

// Dev/e2e path for POST /api/contact; production is the octav-contact Lambda
// behind the CloudFront /api/contact/* behavior (Feature 3). Logic lives in
// src/lib/contact/http-handler.ts.
export async function POST(req: Request) {
  return handleContactPost(req);
}
