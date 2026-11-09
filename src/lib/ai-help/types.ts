import { z } from 'zod';
import { questionSchema, subjectIdSchema } from '@/content/schema';
import { AI_MARK_PREMIUM_MONTHLY_CAP, type Tier } from '@/lib/entitlements/features';

export const AI_HELP_FREE_MONTHLY_QUOTA = 60;
export const AI_HELP_PREMIUM_MONTHLY_CAP = AI_MARK_PREMIUM_MONTHLY_CAP;

export const aiHelpRequestSchema = z.object({
  action: z.enum(['simpler', 'hint', 'worked-example', 'why-wrong']),
  subjectId: subjectIdSchema,
  topicId: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(64),
  selectedIndex: z.number().int().min(-1).max(3),
  question: questionSchema.extend({
    id: z.string().min(1).max(64),
    stem: z.string().min(1).max(2000),
    choices: z.array(z.string().min(1).max(1000)).length(4),
    explanation: z.string().min(1).max(4000),
  }),
});

export const aiHelpResultSchema = z.object({
  help: z.string().min(1).max(2000),
});

export type AiHelpRequest = z.infer<typeof aiHelpRequestSchema>;
export type AiHelpResult = z.infer<typeof aiHelpResultSchema>;

export const aiHelpUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});
export type AiHelpUsage = z.infer<typeof aiHelpUsageSchema>;
export type AiHelpProviderResult = AiHelpResult & { usage?: AiHelpUsage };

export interface AiHelpProvider {
  help(req: AiHelpRequest, context: { topicTitle: string; year?: number; notes: string }): Promise<AiHelpProviderResult>;
}

export function aiHelpQuotaForTier(tier: Tier): number {
  return tier === 'premium' ? AI_HELP_PREMIUM_MONTHLY_CAP : AI_HELP_FREE_MONTHLY_QUOTA;
}

export function aiHelpBucket(userId: string, monthKey: string): string {
  return `aihelp:${userId}:${monthKey}`;
}
