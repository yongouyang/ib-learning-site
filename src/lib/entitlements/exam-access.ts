// Phase E3 — the free/premium split for the practice-exam tier
// (docs/entitlement-policy.md §Tier 2, docs/entitlement-implementation-plan.md
// E3). Enforcement is UX-only: these helpers decide what LockedFeature wraps;
// the static bundle ships every question regardless (accepted risk, policy
// §Enforcement). Pure and client-safe.

/** "First set per course free" (policy). Set ids follow `<courseId>-set-<n>`. */
export const FREE_PAPER_SETS_PER_COURSE = 1;

/**
 * Revision ladder: levels 1–2 free, the upper levels (3–5) premium. The policy
 * names "upper levels" without a count — two free levels keep the
 * unlock-by-score mechanic tangible before the paywall.
 */
export const FREE_LADDER_LEVELS = 2;

/** The set number from a paper id (`<courseId>-set-<n>`); 1 when absent. */
export function paperSetNumber(paperId: string): number {
  const match = /-set-(\d+)$/.exec(paperId);
  return match ? Number.parseInt(match[1], 10) : 1;
}

export function isFreePaperSet(paperId: string): boolean {
  return paperSetNumber(paperId) <= FREE_PAPER_SETS_PER_COURSE;
}

export function isFreeLadderLevel(level: number): boolean {
  return level <= FREE_LADDER_LEVELS;
}

/** Free/locked split of a course's paper sets, ordered by set number. */
export function splitPaperSetsByAccess<T extends { id: string }>(sets: T[]): { free: T[]; locked: T[] } {
  const sorted = [...sets].sort((a, b) => paperSetNumber(a.id) - paperSetNumber(b.id));
  return {
    free: sorted.filter((s) => isFreePaperSet(s.id)),
    locked: sorted.filter((s) => !isFreePaperSet(s.id)),
  };
}
