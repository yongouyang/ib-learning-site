import { describe, it, expect } from 'vitest';
import {
  AI_MARK_FREE_MONTHLY_QUOTA,
  AI_MARK_PREMIUM_MONTHLY_CAP,
  FEATURE_IDS,
  TIER_FEATURES,
  aiMarkQuotaForTier,
  featureIdSchema,
  featuresForTier,
  tierSchema,
} from '@/lib/entitlements/features';

// Phase E0 — the static tier → featureId[] map is the single source of truth
// for entitlement derivation until the E4 DynamoDB Feature/Entitlement tables.

describe('entitlements/features (E0)', () => {
  it('tierSchema parses the two tiers and rejects anything else', () => {
    expect(tierSchema.parse('free')).toBe('free');
    expect(tierSchema.parse('premium')).toBe('premium');
    expect(tierSchema.safeParse('gold').success).toBe(false);
    expect(tierSchema.safeParse(undefined).success).toBe(false);
    expect(tierSchema.safeParse(null).success).toBe(false);
  });

  it('featureIdSchema accepts exactly the declared feature ids', () => {
    for (const id of FEATURE_IDS) {
      expect(featureIdSchema.parse(id)).toBe(id);
    }
    expect(featureIdSchema.safeParse('unlimited-everything').success).toBe(false);
  });

  it('TIER_FEATURES covers every tier and uses only declared feature ids', () => {
    expect(Object.keys(TIER_FEATURES).sort()).toEqual(['free', 'premium']);
    for (const ids of Object.values(TIER_FEATURES)) {
      for (const id of ids) {
        expect(FEATURE_IDS).toContain(id);
      }
    }
  });

  it('free tier: quota-limited AI marking only', () => {
    expect(featuresForTier('free')).toEqual(['ai-marking']);
  });

  it('premium tier: everything free has, plus unlimited marking and full exam sets', () => {
    const premium = featuresForTier('premium');
    expect(premium).toEqual(['ai-marking', 'ai-marking-unlimited', 'exam-sets-full']);
    // Premium is a superset of free.
    for (const id of featuresForTier('free')) {
      expect(premium).toContain(id);
    }
  });

  it('featuresForTier returns a copy — mutating it cannot corrupt the map', () => {
    const ids = featuresForTier('premium');
    ids.pop();
    expect(featuresForTier('premium')).toHaveLength(3);
  });

  it('quota constants match the agreed policy (30/month free, 1000/month premium cap)', () => {
    expect(AI_MARK_FREE_MONTHLY_QUOTA).toBe(30);
    expect(AI_MARK_PREMIUM_MONTHLY_CAP).toBe(1000);
  });

  it('aiMarkQuotaForTier maps free → 30 and premium → the 1000 safety cap (E2)', () => {
    expect(aiMarkQuotaForTier('free')).toBe(AI_MARK_FREE_MONTHLY_QUOTA);
    expect(aiMarkQuotaForTier('premium')).toBe(AI_MARK_PREMIUM_MONTHLY_CAP);
  });
});
