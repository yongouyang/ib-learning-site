import { handleAdminDynamo } from '@/lib/admin/http-handler';

// Dev/e2e path for POST /api/admin/dynamodb; production is the octav-admin
// Lambda behind the CloudFront /api/admin/* behavior (Feature 2). Logic lives
// in src/lib/admin/http-handler.ts.
export async function POST(req: Request) {
  return handleAdminDynamo(req);
}
