import { handleExportGet } from '@/lib/auth/http-handler';

// Dev/e2e path for GET /api/auth/export (data portability, plan §9 Q8);
// production is the Lambda behind the CloudFront /api/auth/* behavior.
export async function GET(req: Request) {
  return handleExportGet(req);
}
