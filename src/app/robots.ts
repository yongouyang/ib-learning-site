import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';

// Static by nature; force-static lets `output: 'export'` emit it (unchanged from today).
export const dynamic = 'force-static';

/**
 * Blocked = bulk AI *training* crawlers. Retrieval/answer crawlers are deliberately
 * ALLOWED (see AI_ANSWER_ENGINES) — they are how we surface in ChatGPT/Claude/Copilot
 * answers, and Bing's AdaptiveCrawler is treated as a search-index bot, not a trainer.
 * (docs/seo-technical-plan.md §4.1, step S2b.)
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',            // OpenAI training corpus
  'CCBot',             // Common Crawl (feeds many trainers)
  'Bytespider',        // Bytedance/TikTok
  'Amazonbot',         // Alexa training
  'Applebot-Extended', // Apple Intelligence training (Applebot itself stays allowed)
  'meta-externalagent',// Meta AI assistant training
  'ClaudeBot',         // Anthropic training crawl (Claude-User/Claude-SearchBot allowed)
  'anthropic-ai',
  'Google-Extended',   // Gemini training — does NOT affect Search/AI Overviews eligibility
];

/** Answer-engine retrieval — explicitly Allow'd so intent survives future rule edits. */
const AI_ANSWER_ENGINES = [
  'OAI-SearchBot',     // ChatGPT search retrieval
  'ChatGPT-User',      // user-initiated fetch — NOTE: was blocked by the old file
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'DuckAssistantBot',
  'Applebot',          // Apple Siri/Spotlight retrieval
];

/** Non-pages. Disallow here; page-shaped surfaces use meta robots (see plan §4.2). */
const NEVER_CRAWLED = [
  '/api/',            // auth/progress/analytics/feedback/leaderboard/contact Lambdas + _health probes
  '/admin/',          // analytics + dynamodb consoles
  '/offline',         // SW offline shell
  '/_next/',          // hashed bundles + RSC payloads
  '/progress',
  '/account',
  '/login',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 1. Everyone (incl. Googlebot + Bingbot): the curriculum tree is open.
      { userAgent: '*', allow: '/', disallow: NEVER_CRAWLED },
      // 2. AI answer engines: full access, stated positively.
      { userAgent: AI_ANSWER_ENGINES, allow: '/' },
      // 3. Training crawlers: nothing.
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
    ],
    // Single entry point; the index lists the curriculum-split children.
    sitemap: `${SITE.origin}/sitemap/index.xml`,
    host: SITE.origin,
  };
}
