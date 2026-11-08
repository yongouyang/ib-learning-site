import { handleAiHelpPost } from '@/lib/ai-help/http-handler';

export async function POST(req: Request) {
  return handleAiHelpPost(req);
}
