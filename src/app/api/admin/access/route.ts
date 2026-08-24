import { handleAdminAccess } from '@/lib/admin/http-handler';

// Dev/e2e path for GET /api/admin/access (the in-app admin entry-point check);
// production is the octav-admin Lambda behind the CloudFront /api/admin/*
// behavior (Feature 2).
export async function GET(req: Request) {
  return handleAdminAccess(req);
}
