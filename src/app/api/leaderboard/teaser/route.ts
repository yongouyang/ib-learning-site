import { handleLeaderboardTeaser } from '@/lib/leaderboard/http-handler';

// Dev/e2e path for GET /api/leaderboard/teaser (the PUBLIC logged-out teaser);
// production is the Lambda behind the CloudFront /api/leaderboard/* behavior
// (D7). Logic lives in src/lib/leaderboard/http-handler.ts.
export async function GET(req: Request) {
  return handleLeaderboardTeaser(req);
}
