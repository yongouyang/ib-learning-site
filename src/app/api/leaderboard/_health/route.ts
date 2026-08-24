import { handleLeaderboardHealth } from '@/lib/leaderboard/http-handler';

// Dev/e2e path for GET /api/leaderboard/_health (the CI smoke probe);
// production is the Lambda behind the CloudFront /api/leaderboard/* behavior
// (D7).
export async function GET(req: Request) {
  return handleLeaderboardHealth(req);
}
