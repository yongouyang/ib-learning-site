import type { Stage, Topic } from '../../content/types';

export type TierKey = 'ks3' | 'igcse' | 'ibdp';

export interface TierMeta {
  segment: string;
  label: string;
  hubTitle: string;
  /** The qualification a learner sits. null = no award exists at this tier (KS3). */
  credential: string | null;
}

export const TIERS: Record<TierKey, TierMeta> = {
  ks3: { segment: 'ks3', label: 'KS3', hubTitle: 'Key Stage 3 (ages 11–14)', credential: null },
  igcse: { segment: 'igcse', label: 'IGCSE', hubTitle: 'International GCSE', credential: 'Cambridge International GCSE (9–1)' },
  ibdp: { segment: 'ibdp', label: 'IB DP', hubTitle: 'IB Diploma Programme', credential: 'IB Diploma Programme certificate' },
};

const STAGE_TO_TIER: Record<Stage, TierKey> = { ks3: 'ks3', igcse: 'igcse', dp: 'ibdp' };

export const tierOfTopic = (t: { stage: Stage }): TierKey => STAGE_TO_TIER[t.stage];
export const tierMeta = (t: { stage: Stage }): TierMeta => TIERS[tierOfTopic(t)];

/** The indexed canonical leaf. quiz/flashcards are noindex variants of this URL. */
export const STUDY_PATH = (t: { subjectId: string; id: string }) => `/subjects/${t.subjectId}/${t.id}/study`;
export const topicPath = STUDY_PATH;

export const tierHubPath = (tier: TierKey) => `/${TIERS[tier].segment}`;
export const tierSubjectPath = (tier: TierKey, subjectId: string) => `/${TIERS[tier].segment}/${subjectId}`;

/** "Key Stage 3, Year 7" | "International GCSE" | "IB DP AI (SL)" — used in titles + educationalLevel. */
export function curriculumLabel(t: Topic): string {
  if (t.stage === 'ks3') return t.year ? `Key Stage 3, Year ${t.year}` : 'Key Stage 3';
  if (t.stage === 'dp') return `IB DP${t.course ? ` ${t.course.toUpperCase()}` : ''}${t.level ? ` (${t.level.toUpperCase()})` : ''}`;
  return TIERS.igcse.hubTitle;
}

/** Only where a credential genuinely exists; KS3 awards nothing. */
export const credentialFor = (t: Topic): string | null => tierMeta(t).credential;

/**
 * Derivable, stable, never hand-written: `MATH-KS3-Y7-ANGLES`, `CHEM-KS3-Y7-STATES-1`,
 * `MATH-IBDP-AI-SEQUENCES`. Structural tokens (subject abbrev, year, stage, course, level)
 * are encoded once in the prefix, so they are stripped from the slug half — but numeric
 * discriminators are KEPT, because `bio-body-1` and `bio-body-2` must not collapse.
 * Uniqueness across the whole registry is asserted in tests/unit/seo.test.ts.
 */
export function courseCodeFor(t: Topic): string {
  const tier = tierMeta(t);
  const subject = t.subjectId.slice(0, 4).toUpperCase();
  const stageToken = [t.subjectId, `yr${t.year ?? ''}`, `y${t.year ?? ''}`, tier.segment, 'dp', 'igcse', t.course, t.level]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  const slug = t.id
    .split('-')
    .filter((tok, i) => i > 0 && !stageToken.includes(tok.toLowerCase()))
    .join('-')
    .toUpperCase();
  const mid = t.year ? `Y${t.year}` : t.course ? t.course.toUpperCase() : t.level ? t.level.toUpperCase() : '';
  return [subject, tier.label.replace(/\s/g, ''), mid, slug].filter(Boolean).join('-');
}
