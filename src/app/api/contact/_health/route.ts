import { handleContactHealth } from '@/lib/contact/http-handler';

// Dev/e2e path for GET /api/contact/_health (the CI smoke probe); production
// is the octav-contact Lambda behind the CloudFront /api/contact/* behavior
// (Feature 3).
export async function GET(req: Request) {
  return handleContactHealth(req);
}
