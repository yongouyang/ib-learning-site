export const SITE = {
  origin: 'https://octavlearning.com',
  name: 'Octav Learning',
  inLanguage: 'en-GB',
  /**
   * One site-wide description: the homepage <meta name="description">, its og/twitter
   * copy, and the JSON-LD Organization node. Kept under `page-meta.ts`'s DESC_BUDGET
   * (158) so the SERP never truncates it. The old copy was hand-copied in three places
   * and still said "Math, English and the Sciences" — six subjects short.
   */
  description:
    'Illustrated notes, smart flashcards, marked practice and timed mock exams for KS3, IGCSE and IB DP — ten subjects, free to start.',
};

/**
 * The site-wide social card. A plain file under `public/` (NOT Next's
 * `opengraph-image` file convention): the convention emits a build-hashed URL and a
 * route that defines its own `openGraph` object drops the inherited image — which is
 * every hub, topic and tool page here. Referenced explicitly by all three metadata
 * builders instead (meta.ts, page-meta.ts, the root layout).
 * Regenerate with `node scripts/generate-og-image.mjs` after editing public/og/og.svg.
 */
export const SOCIAL_IMAGE = {
  url: `${SITE.origin}/og/og-1200x630.png`,
  width: 1200,
  height: 630,
  alt: 'Octav Learning — illustrated notes, flashcards and marked practice for KS3, IGCSE and IB DP',
} as const;
