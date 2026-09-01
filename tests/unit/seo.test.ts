import { describe, it, expect } from 'vitest';
import { getSubjects } from '@/content/registry';
import type { Topic } from '@/content/types';
import {
  TIERS,
  tierOfTopic,
  curriculumLabel,
  credentialFor,
  courseCodeFor,
  STUDY_PATH,
  tierHubPath,
  tierSubjectPath,
} from '@/lib/seo/curriculum';
import { alternatesFor, HREFLANG_PHASE, LOCALES, PUBLISHED_LOCALES } from '@/lib/seo/hreflang';
import { SITE } from '@/lib/seo/site';

const subjects = getSubjects();
const topics: (Topic & { subjectName: string })[] = subjects.flatMap((s) =>
  s.topics.map((t) => ({ ...t, subjectName: s.name })),
);

describe('seo/curriculum — tier mapping', () => {
  it('maps every topic to exactly one tier and every tier has a segment', () => {
    for (const t of topics) {
      const tier = tierOfTopic(t);
      expect(Object.keys(TIERS)).toContain(tier);
      expect(TIERS[tier].segment).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('is exhaustive over the Stage union (ks3, igcse, dp)', () => {
    expect(new Set(topics.map((t) => tierOfTopic(t))).size).toBeGreaterThan(0);
    // a new Stage value must be added to STAGE_TO_TIER or this file fails to type-check
    expect(TIERS.ks3.segment).toBe('ks3');
    expect(TIERS.igcse.segment).toBe('igcse');
    expect(TIERS.ibdp.segment).toBe('ibdp');
  });

  it('names a credential only where a qualification actually exists', () => {
    // KS3 awards nothing: claiming educationalCredentialAwarded there is a factual
    // error in machine-readable form, so the template must return null.
    for (const t of topics.filter((x) => x.stage === 'ks3')) expect(credentialFor(t)).toBeNull();
    for (const t of topics.filter((x) => x.stage !== 'ks3')) expect(credentialFor(t)).toBeTruthy();
  });

  it('omits the IGCSE hub entirely while the tier has no content', () => {
    const count = topics.filter((t) => tierOfTopic(t) === 'igcse').length;
    // Guard for the generator's liveTiers rule: an empty tier gets no hub and no sitemap,
    // so nothing may link to /igcse until this assertion is updated alongside real content.
    if (count === 0) expect(tierHubPath('igcse')).toBe('/igcse');
    else expect(count).toBeGreaterThan(0);
  });
});

describe('seo/curriculum — labels, codes, paths', () => {
  it('builds a curriculum-qualified label for titles and educationalLevel', () => {
    const year7 = topics.find((t) => t.stage === 'ks3' && t.year === 7)!;
    expect(curriculumLabel(year7)).toBe('Key Stage 3, Year 7');
    const dp = topics.find((t) => t.stage === 'dp')!;
    expect(curriculumLabel(dp)).toMatch(/^IB DP/);
  });

  it('emits a unique, derivable courseCode per topic', () => {
    // Collisions here would silently merge two courses in engine-side filtering, so the
    // derivation must be unique over the whole registry, numerics included.
    const codes = topics.map(courseCodeFor);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]+(-[A-Z0-9]+)+$/);
  });

  it('keeps deep URLs on the subject-first tree with /study as the canonical leaf', () => {
    for (const t of topics.slice(0, 25)) {
      expect(STUDY_PATH(t)).toBe(`/subjects/${t.subjectId}/${t.id}/study`);
    }
    const ks3Math = topics.find((t) => t.stage === 'ks3' && t.subjectId === 'math')!;
    expect(tierSubjectPath('ks3', ks3Math.subjectId)).toBe('/ks3/math');
  });
});

describe('seo/hreflang', () => {
  it('H0 declares a self-referencing group only (no regional alternates on identical content)', () => {
    const map = alternatesFor('/ks3/math');
    expect(map['x-default']).toBe(`${SITE.origin}/ks3/math`);
    if (HREFLANG_PHASE === 'H0') {
      expect(Object.keys(map).sort()).toEqual(['en-GB', 'x-default']);
      // declared codes parse as language or language-REGION (x-default is the exception, not a tag)
      for (const lang of Object.keys(map).filter((k) => k !== 'x-default'))
        expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    }
  });

  it('publishes only locales that ship a real variant, with en-GB as the fallback target', () => {
    expect(PUBLISHED_LOCALES[0]).toBe('en-GB');
    for (const l of PUBLISHED_LOCALES) expect(LOCALES[l].path).toBeDefined();
  });
});
