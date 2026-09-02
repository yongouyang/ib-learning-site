import type { Metadata } from 'next';
import type { Subject, SubjectId, Topic } from '@/content/types';
import { getSubjects } from '@/content/registry';
import { COURSES, getCourseTopics } from '../courses';
import { TIERS, tierHubPath, tierOfTopic, tierSubjectPath, type TierKey } from './curriculum';
import { alternatesFor } from './hreflang';
import { subjectSeoName } from './meta';
import { pageMeta } from './page-meta';

/**
 * Tier hub routes (docs/seo-technical-plan.md §1.1, step S3): /ks3, /ibdp and their
 * tier×subject children. The URL set is derived, never hardcoded, and mirrors the
 * sitemap generator's child emission (scripts/generate-sitemaps.ts coreEntries) so
 * `verify:sitemaps` can never report a hub 404. An empty tier or a subject with no
 * topics in the tier yields NO route — IGCSE has zero topics today.
 */

export interface TierSubjectHub {
  subject: Subject;
  /** The subject's topics in this tier, in registry (order.json) sequence. */
  topics: Topic[];
}

/**
 * Hub children for a tier. KS3/IGCSE come straight from the registry subjects; IBDP
 * is derived through the course groupings (src/lib/courses.ts), so a course with zero
 * dp-stage topics produces nothing. tests/unit/seo.test.ts asserts the IBDP set covers
 * every dp topic in the registry, keeping both derivations honest.
 */
export function tierSubjects(tier: TierKey): TierSubjectHub[] {
  const topicsBySubject = new Map<SubjectId, Topic[]>();
  if (tier === 'ibdp') {
    const seen = new Set<string>();
    for (const course of COURSES) {
      for (const topic of getCourseTopics(course)) {
        if (tierOfTopic(topic) !== tier || seen.has(topic.id)) continue;
        seen.add(topic.id);
        const list = topicsBySubject.get(topic.subjectId) ?? [];
        list.push(topic);
        topicsBySubject.set(topic.subjectId, list);
      }
    }
  } else {
    for (const subject of getSubjects()) {
      const list = subject.topics.filter((t) => tierOfTopic(t) === tier);
      if (list.length > 0) topicsBySubject.set(subject.id, list);
    }
  }
  return getSubjects()
    .filter((s) => topicsBySubject.has(s.id))
    .map((subject) => ({ subject, topics: topicsBySubject.get(subject.id)! }));
}

export function tierSubject(tier: TierKey, subjectId: string): TierSubjectHub | undefined {
  return tierSubjects(tier).find((h) => h.subject.id === subjectId);
}

/**
 * Hub metadata = pageMeta (brand-free title, budgeting, og/twitter) plus hreflang:
 * hubs are the ONLY URLs that emit alternates (plan §3.2 — the 217 deep topic pages
 * keep the plain self-canonical).
 */
function hubMeta(path: string, title: string, description: string): Metadata {
  return {
    ...pageMeta({ path, title, description }),
    alternates: { canonical: path, languages: alternatesFor(path) },
  };
}

/** /ks3 | /ibdp — tier hub ("KS3 revision", "IB DP revision"). */
export function metaForTierHub(tier: TierKey): Metadata {
  const hubs = tierSubjects(tier);
  const count = hubs.reduce((n, h) => n + h.topics.length, 0);
  const label = TIERS[tier].label;
  const description =
    tier === 'ks3'
      ? `${count} KS3 topics across ${hubs.length} subjects — illustrated notes, flashcards and marked quizzes for Years 7–9. Free to start.`
      : `${count} IB Diploma Programme topics — illustrated notes, flashcards and practice questions with worked answers. Free to start.`;
  return hubMeta(tierHubPath(tier), `${label} revision`, description);
}

/** /ks3/<subjectId> | /ibdp/<subjectId> — tier×subject hub ("KS3 Maths"). Undefined when the subject has no topics in the tier (→ no route). */
export function metaForTierSubject(tier: TierKey, subjectId: string): Metadata | undefined {
  const hub = tierSubject(tier, subjectId);
  if (!hub) return undefined;
  const label = TIERS[tier].label;
  const seo = subjectSeoName(hub.subject.name);
  const description =
    tier === 'ks3'
      ? `${hub.topics.length} KS3 ${seo} topics — illustrated notes, flashcards and a marked quiz on every topic. Free to start.`
      : `${hub.topics.length} IB DP ${seo} topics — illustrated notes, flashcards and practice questions with worked answers. Free to start.`;
  return hubMeta(tierSubjectPath(tier, hub.subject.id), `${label} ${seo}`, description);
}
