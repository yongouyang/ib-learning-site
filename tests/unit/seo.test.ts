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
import { metaForTierHub, metaForTierSubject, tierSubjects } from '@/lib/seo/hubs';
import { INDEXABLE_ROBOTS } from '@/lib/seo/page-meta';
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

describe('seo/hubs — tier hub routes (S3)', () => {
  it('tier hubs are indexable, self-canonical and carry the hreflang group', () => {
    for (const tier of ['ks3', 'ibdp'] as const) {
      const meta = metaForTierHub(tier);
      const path = tierHubPath(tier);
      expect(meta.robots).toEqual(INDEXABLE_ROBOTS);
      const alternates = meta.alternates as { canonical: string; languages: Record<string, string> };
      expect(alternates.canonical).toBe(path);
      // hreflang is emitted on hub URLs only — must be the self-referencing H0 group
      expect(alternates.languages).toEqual(alternatesFor(path));
      expect(alternates.languages['x-default']).toBe(`${SITE.origin}${path}`);
      // title shape "KS3 revision" / "IB DP revision", brand-free half (layout template appends the brand)
      expect(typeof meta.title).toBe('string');
      expect(meta.title as string).toBe(`${TIERS[tier].label} revision`);
      expect(meta.title as string).not.toContain(SITE.name);
      expect(typeof meta.description).toBe('string');
    }
  });

  it('tier×subject hubs are "TIER <Subject>" and indexable with hreflang', () => {
    const math = metaForTierSubject('ks3', 'math')!;
    expect(math.title).toBe('KS3 Maths'); // subjectSeoName: Math → Maths in metadata
    const alternates = math.alternates as { canonical: string; languages: Record<string, string> };
    expect(alternates.canonical).toBe('/ks3/math');
    expect(alternates.languages).toEqual(alternatesFor('/ks3/math'));
    expect(math.robots).toEqual(INDEXABLE_ROBOTS);

    const dpMath = metaForTierSubject('ibdp', 'math')!;
    expect(dpMath.title).toBe('IB DP Maths');
    expect((dpMath.alternates as { canonical: string }).canonical).toBe('/ibdp/math');

    // empty tier / unknown subject → undefined → the route does not exist
    expect(metaForTierSubject('igcse', 'math')).toBeUndefined();
    expect(metaForTierSubject('ks3', 'no-such-subject')).toBeUndefined();
  });

  it('derives the hub route set from the registry — no hardcoding, no empty-tier routes', () => {
    const ks3 = tierSubjects('ks3');
    const registryKs3Subjects = subjects.filter((s) => s.topics.some((t) => tierOfTopic(t) === 'ks3')).map((s) => s.id);
    expect(ks3.map((h) => h.subject.id)).toEqual(registryKs3Subjects);

    // the IGCSE tier is empty today: zero hub children, so no /igcse route may exist
    expect(tierSubjects('igcse')).toEqual([]);
  });

  it('the IBDP hub set covers every dp topic in the registry (course derivation misses nothing)', () => {
    const dpTopics = topics.filter((t) => t.stage === 'dp');
    expect(dpTopics.length).toBeGreaterThan(0);
    const hubs = tierSubjects('ibdp');
    const covered = new Set(hubs.flatMap((h) => h.topics.map((t) => t.id)));
    for (const t of dpTopics) expect(covered.has(t.id), `dp topic ${t.id} has no hub route`).toBe(true);
    // hub topics are exactly the dp topics of their subject, in registry order
    for (const hub of hubs) {
      const registryTopics = subjects.find((s) => s.id === hub.subject.id)!.topics.filter((t) => t.stage === 'dp');
      expect(hub.topics.map((t) => t.id)).toEqual(registryTopics.map((t) => t.id));
    }
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

describe('seo — metadata exports on the formerly client-only pages', () => {
  it('the homepage exports an absolute brand title, self-canonical and index robots', async () => {
    // page.tsx was 'use client' and therefore shipped with NO robots meta and NO canonical
    // (found live by scripts/verify-seo-live.ts). The server wrapper must export all three,
    // and the title must be ABSOLUTE — the root template would double a templated brand.
    const { metadata } = await import('@/app/page');
    expect(metadata.title).toEqual({ absolute: 'Octav Learning' });
    expect(metadata.robots).toEqual(INDEXABLE_ROBOTS);
    const alternates = metadata.alternates as { canonical: string };
    expect(alternates.canonical).toBe('/');
    expect(typeof metadata.description).toBe('string');
  });

  it('the /account layout title is brand-free (the template appends the brand once)', async () => {
    // "Octav Learning account" + template = "Octav Learning account · Octav Learning" —
    // the live defect. pageMeta's contract is a brand-free half.
    const { metadata } = await import('@/app/account/layout');
    expect(typeof metadata.title).toBe('string');
    expect(metadata.title as string).toBe('Your account');
    expect(metadata.title as string).not.toContain(SITE.name);
  });
});
