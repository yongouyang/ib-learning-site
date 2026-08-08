import type { MetadataRoute } from 'next';

// Static by nature; force-static lets `output: 'export'` (build:static) emit it.
export const dynamic = 'force-static';

// Normal crawling stays open (we want to be found), but known AI-training
// crawlers are disallowed site-wide. Courtesy-level protection only — see
// docs/phase-7-implementation-plan.md §8.
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'CCBot',
  'Google-Extended',
  'ClaudeBot',
  'anthropic-ai',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: AI_TRAINING_CRAWLERS,
        disallow: '/',
      },
    ],
  };
}
