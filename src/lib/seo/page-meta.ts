import type { Metadata } from 'next';
import { SITE } from './site';
import { clipToWidth, displayWidth, plainText } from './text';

/**
 * Shared title/description/canonical/robots builder for every non-topic page.
 *
 * Titles are returned WITHOUT the brand: the root layout's
 * `title.template: '%s · Octav Learning'` appends it exactly once. Pages that set
 * `title: 'X — Octav Learning'` themselves end up shipping "X — Octav Learning ·
 * Octav Learning" (the live defect on /pricing, /terms and /offline), so this module
 * is the only sanctioned way to build a page title.
 */

/** Google truncates by rendered pixel width; ~600px ≈ 60 cells at our type scale. */
export const TITLE_BUDGET = 60;
/** Past ~155 cells the desktop SERP truncates the description. */
export const DESC_BUDGET = 158;
export const BRAND_SUFFIX = ` · ${SITE.name}`;

export const INDEXABLE_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  'max-snippet': -1,
  'max-image-preview': 'large',
};

/**
 * noindex, follow — used for surfaces that must never compete in the index (premium
 * walls, user state, the offline shell) but whose links still have to be crawled so
 * the equity flows and the directive itself is readable. A robots.txt Disallow cannot
 * be combined with noindex: the crawler never fetches the page, so the URL stays in the
 * index as "Indexed, though blocked by robots.txt".
 */
export const NOINDEX_ROBOTS: Metadata['robots'] = { index: false, follow: true };

export interface PageMetaInput {
  /** Extensionless, origin-relative path — also the canonical target. */
  path: string;
  /** Without the brand; the layout template appends it. */
  title: string;
  description: string;
  /** false → noindex, follow. Default true. */
  indexable?: boolean;
  /**
   * True for pages that must not carry the templated brand: keeps the option local
   * instead of inviting a second title convention. The homepage is the one consumer —
   * its title IS the bare brand, so the template would double it.
   */
  absolute?: boolean;
  /**
   * Override the SERP width budget. Only sensible for noindex pages: they never appear in
   * a truncated search snippet, so their title exists for the browser tab and history list,
   * where the FULL topic name beats a clipped one (see metaForTool).
   */
  titleBudget?: number;
}

export function pageMeta({ path, title, description, indexable = true, absolute = false, titleBudget }: PageMetaInput): Metadata {
  const bare = plainText(title);
  const budget = titleBudget ?? TITLE_BUDGET;
  const headTitle = absolute
    ? clipToWidth(bare, budget)
    : clipToWidth(bare, budget - displayWidth(BRAND_SUFFIX));
  const fullTitle = absolute ? headTitle : `${headTitle} · ${SITE.name}`;
  const desc = clipToWidth(plainText(description), DESC_BUDGET);
  return {
    title: absolute ? { absolute: headTitle } : headTitle,
    description: desc,
    alternates: { canonical: path },
    robots: indexable ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS,
    openGraph: {
      type: 'website',
      url: `${SITE.origin}${path}`,
      // og:title bypasses the layout template, so the brand is added explicitly.
      title: fullTitle,
      description: desc,
      siteName: SITE.name,
    },
    twitter: { card: 'summary', title: fullTitle, description: desc },
  };
}
