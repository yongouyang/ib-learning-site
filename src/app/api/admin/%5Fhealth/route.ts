import { handleAdminHealth } from '@/lib/admin/http-handler';

// Dev/e2e path for GET /api/admin/_health (the CI smoke probe); production is
// the octav-admin Lambda behind the CloudFront /api/admin/* behavior
// (Feature 2).
export async function GET(req: Request) {
  return handleAdminHealth(req);
}
