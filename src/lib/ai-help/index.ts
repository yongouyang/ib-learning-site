import { FeedbackNotConfiguredError } from '@/lib/feedback/types';
import { DummyAiHelpProvider } from './dummy';
import { OpenAICompatibleHelpProvider } from './openai-compatible';
import type { AiHelpProvider } from './types';

export function getAiHelpProvider(env: NodeJS.ProcessEnv = process.env): AiHelpProvider {
  if (env.FEEDBACK_PROVIDER === 'dummy') return new DummyAiHelpProvider();
  if (env.FEEDBACK_PROVIDER === 'openai-compatible') {
    if (!env.FEEDBACK_API_KEY) throw new FeedbackNotConfiguredError('FEEDBACK_API_KEY is not set');
    return new OpenAICompatibleHelpProvider({
      apiKey: env.FEEDBACK_API_KEY,
      model: env.FEEDBACK_MODEL ?? 'moonshot-v1-8k',
      baseUrl: env.FEEDBACK_BASE_URL ?? 'https://api.moonshot.ai/v1',
    });
  }
  throw new FeedbackNotConfiguredError('FEEDBACK_PROVIDER is not set');
}
