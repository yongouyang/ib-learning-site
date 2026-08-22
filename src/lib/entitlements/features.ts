import { z } from 'zod';

// Phase E0 — entitlement derivation (docs/entitlement-implementation-plan.md).
// Until Stripe lands (E4), entitlement is DERIVED from a tier field on the
// user record via the static tier → featureId[] map below; the §2.9 DynamoDB
// Feature/Entitlement tables replace this map at subscription build time.
// This module is pure and client-safe — the auth http-handler (server, the
// single source of truth) and the EntitlementsContext (client) both read the
// SAME map.

export const tierSchema = z.enum(['free', 'premium']);
export type Tier = z.infer<typeof tierSchema>;

/**
 * Gated features (docs/entitlement-policy.md). Tier-0 anonymous content
 * (notes, flashcards, quizzes, diagnostics) is never gated, so it has no
 * feature id. 'ai-marking' is the quota-limited free taste (login required);
 * premium adds the unlimited + full-exam-tier flags on top.
 */
export const FEATURE_IDS = ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];
export const featureIdSchema = z.enum(FEATURE_IDS);

/** Free tier: 30 AI marks per calendar month per account (policy agreed 2026-08-22). */
export const AI_MARK_FREE_MONTHLY_QUOTA = 30;
/** Premium safety cap — bounds runaway-cost bugs; revisit with real usage data (policy). */
export const AI_MARK_PREMIUM_MONTHLY_CAP = 1000;

export const TIER_FEATURES: Record<Tier, FeatureId[]> = {
  free: ['ai-marking'],
  premium: ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'],
};

/** The ONE derivation both server (me payload) and client (login fallback) use. */
export function featuresForTier(tier: Tier): FeatureId[] {
  return [...TIER_FEATURES[tier]];
}

/**
 * Monthly AI-mark quota per tier (Phase E2): 30 free marks per calendar month
 * per account (policy agreed 2026-08-22); premium is "unlimited" behind the
 * 1,000/month safety cap that bounds runaway-cost bugs. The feedback handler
 * enforces this server-side from the session user's tier.
 */
export function aiMarkQuotaForTier(tier: Tier): number {
  return tier === 'premium' ? AI_MARK_PREMIUM_MONTHLY_CAP : AI_MARK_FREE_MONTHLY_QUOTA;
}
