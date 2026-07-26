import { DummyFeedbackProvider, dummyDefaultFromEnv } from './dummy';
import { OpenAICompatibleProvider } from './openai-compatible';
import { FeedbackNotConfiguredError, type FeedbackProvider } from './types';

const DEFAULT_MODEL = 'moonshot-v1-8k';
const DEFAULT_BASE_URL = 'https://api.moonshot.ai/v1';

export function getFeedbackProvider(env: NodeJS.ProcessEnv = process.env): FeedbackProvider {
  const kind = env.FEEDBACK_PROVIDER;

  if (kind === 'dummy') {
    return new DummyFeedbackProvider(dummyDefaultFromEnv(env));
  }

  if (kind === 'openai-compatible') {
    if (!env.FEEDBACK_API_KEY) {
      throw new FeedbackNotConfiguredError('FEEDBACK_API_KEY is not set');
    }
    return new OpenAICompatibleProvider({
      apiKey: env.FEEDBACK_API_KEY,
      model: env.FEEDBACK_MODEL ?? DEFAULT_MODEL,
      baseUrl: env.FEEDBACK_BASE_URL ?? DEFAULT_BASE_URL,
    });
  }

  throw new FeedbackNotConfiguredError(
    'FEEDBACK_PROVIDER is not set (expected "dummy" or "openai-compatible")'
  );
}

export function isFeedbackConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    getFeedbackProvider(env);
    return true;
  } catch {
    return false;
  }
}

export function isTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FEEDBACK_TEST_MODE === '1';
}

export {
  FeedbackNotConfiguredError,
  markRequestSchema,
  markResultSchema,
  marksFromPerPoint,
  MAX_STUDENT_ANSWER_LENGTH,
  MAX_MARKS_PER_QUESTION,
} from './types';
export type { FeedbackProvider, MarkRequest, MarkResult } from './types';
