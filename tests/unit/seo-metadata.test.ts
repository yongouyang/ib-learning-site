import { describe, it, expect } from 'vitest';
import type { Metadata } from 'next';
import { getSubjects, getAllPapers } from '@/content/registry';
import type { Topic } from '@/content/types';
import { isFreeLadderLevel, isFreePaperSet } from '@/lib/entitlements/exam-access';
import { LADDER_LEVELS } from '@/lib/ladder';
import { getExamCourses } from '@/lib/exams';
import { metaForTopic, metaForTool, metaForSubject, subjectSeoName, titleQualifier } from '@/lib/seo/meta';
import { courseQualifier, metaForDiagnostic, metaForLadderOverview, metaForLadderLevel, metaForMockPaper, metaForPaperSet } from '@/lib/seo/assessments';
import { BRAND_SUFFIX, DESC_BUDGET, TITLE_BUDGET } from '@/lib/seo/page-meta';
import { displayWidth, plainText, clipToWidth } from '@/lib/seo/text';

const subjects = getSubjects();
const topics: { topic: Topic; subjectName: string }[] = subjects.flatMap((s) =>
  s.topics.map((t) => ({ topic: t, subjectName: s.name })),
);

/** `<title>` of a page whose title is `{ absolute }` (no template) vs a templated one. */
const renderedTitle = (m: Metadata): string => {
  if (m.title && typeof m.title === 'object' && 'absolute' in m.title) return String(m.title.absolute);
  return `${m.title}${BRAND_SUFFIX}`;
};
const renderedDesc = (m: Metadata): string => String(m.description);
const robotsOf = (m: Metadata): Record<string, unknown> => (m.robots ?? {}) as Record<string, unknown>;

describe('plainText — metadata never leaks KaTeX', () => {
  it('renders every metadata-bearing content string without math syntax', () => {
    // 217 topics × (title, description, 7 note headings) — a literal `$`/`\` in a meta
    // tag reads as junk in the SERP and invites Google to rewrite the title.
    const strings: string[] = [];
    for (const { topic } of topics) {
      strings.push(topic.title, topic.description, ...topic.notes.map((n) => n.heading));
    }
    expect(strings.length).toBeGreaterThan(1800);
    for (const s of strings) {
      const p = plainText(s);
      expect(p).not.toMatch(/[$\\{}]/);
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });

  it('converts the notation the corpus actually uses', () => {
    expect(plainText('Non-linear Regression, Residuals & $R^2$')).toBe('Non-linear Regression, Residuals & R²');
    expect(plainText('Determinants of $3 \\times 3$ Matrices')).toBe('Determinants of 3 × 3 Matrices');
    expect(plainText('Union $A \\cup B$')).toBe('Union A ∪ B');
    expect(plainText('expansion of $(a+b)^n$, the general term.')).toBe('expansion of (a+b)ⁿ, the general term.');
    // '&' is left alone on purpose: it is how the authored titles read (H1 parity).
    expect(plainText('Sequences & Series')).toBe('Sequences & Series');
  });

  it('budgets display width, not characters (CJK costs two cells)', () => {
    // 28 latin cells + 5 CJK counted twice = 33; a character count would say 28 and let
    // a Chinese topic title overflow the SERP.
    expect(displayWidth('Fairy Tales & Fables (童话与寓言)')).toBe(33);
    expect('Fairy Tales & Fables (童话与寓言)'.length).toBe(28);
    expect(displayWidth(clipToWidth('Fairy Tales & Fables (童话与寓言) more words here', 30))).toBeLessThanOrEqual(30);
  });
});

describe('topic page metadata (217 indexed leaves)', () => {
  it('keeps every title inside the SERP width budget', () => {
    for (const { topic, subjectName } of topics) {
      const title = renderedTitle(metaForTopic(topic, subjectName));
      expect(displayWidth(title)).toBeLessThanOrEqual(TITLE_BUDGET);
    }
  });

  it('puts the curriculum in the title of every deep page', () => {
    const angles = topics.find((x) => x.topic.id === 'math-yr7-angles')!;
    expect(renderedTitle(metaForTopic(angles.topic, angles.subjectName))).toBe('Angles — KS3 Year 7 Maths');
    const dp = topics.find((x) => x.topic.stage === 'dp' && x.topic.level === 'hl')!;
    expect(renderedTitle(metaForTopic(dp.topic, dp.subjectName))).toMatch(/IB DP Maths AI HL$/);
  });

  it('uses the UK plural in metadata while the product still says "Math"', () => {
    expect(subjectSeoName('Math')).toBe('Maths');
    expect(subjectSeoName('Biology')).toBe('Biology');
    expect(titleQualifier(topics[0].topic, 'Math')).toMatch(/Maths$/);
  });

  it('describes what is actually on the page, with the counts never clipped away', () => {
    for (const { topic, subjectName } of topics.slice(0, 40)) {
      const d = renderedDesc(metaForTopic(topic, subjectName));
      expect(displayWidth(d)).toBeLessThanOrEqual(DESC_BUDGET);
      expect(d).toContain(`${topic.notes.length} illustrated notes`);
      expect(d).toContain(`${topic.flashcards.length} flashcards`);
      expect(d).toContain(`${topic.questions.length} practice questions`);
    }
  });

  it('self-canonicalises and stays indexable with generous snippet directives', () => {
    const { topic, subjectName } = topics[0];
    const m = metaForTopic(topic, subjectName);
    expect(m.alternates?.canonical).toBe(`/subjects/${topic.subjectId}/${topic.id}/study`);
    expect(robotsOf(m).index).not.toBe(false);
    expect(robotsOf(m)['max-image-preview']).toBe('large');
    expect(robotsOf(m)['max-snippet']).toBe(-1);
  });

  it('mirrors title/description into openGraph + twitter (neither inherits the template)', () => {
    const { topic, subjectName } = topics[0];
    const m = metaForTopic(topic, subjectName);
    expect(String(m.openGraph?.title)).toContain('Octav Learning');
    expect(String(m.twitter?.title)).toBe(renderedTitle(m));
    expect(m.openGraph?.url).toBe(`https://octavlearning.com${m.alternates?.canonical}`);
  });
});

describe('quiz + flashcards: noindex but crawlable', () => {
  it('noindexes every tool page and canonicalises it to /study', () => {
    for (const tool of ['quiz', 'flashcards'] as const) {
      for (const { topic, subjectName } of topics.slice(0, 25)) {
        const m = metaForTool(topic, subjectName, tool);
        expect(robotsOf(m).index).toBe(false);
        expect(robotsOf(m).follow).toBe(true);
        expect(m.alternates?.canonical).toBe(`/subjects/${topic.subjectId}/${topic.id}/study`);
      }
    }
  });

  it('names the tool in the title without blowing the relaxed budget', () => {
    const { topic, subjectName } = topics.find((x) => x.topic.title.length > 40)!;
    const m = metaForTool(topic, subjectName, 'quiz');
    expect(renderedTitle(m)).toContain('quiz');
    expect(displayWidth(renderedTitle(m))).toBeLessThanOrEqual(75);
  });
});

describe('subject hub metadata', () => {
  it('lists only the tiers the subject actually has', () => {
    const math = subjects.find((s) => s.id === 'math')!;
    const t = String(metaForSubject(math).title);
    expect(t).toContain('KS3');
    expect(t).toContain('IB DP');
    expect(t).not.toContain('IGCSE'); // no IGCSE content yet
    expect(displayWidth(`${t}${BRAND_SUFFIX}`)).toBeLessThanOrEqual(TITLE_BUDGET);
  });
});

describe('assessment metadata follows the entitlement code, not a copy of it', () => {
  it('qualifies course pages with the same tier label as their topics', () => {
    expect(courseQualifier('math-y7')).toBe('KS3 Year 7 Maths');
    expect(courseQualifier('math-dp-ai')).toBe('IB DP Maths AI');
    // …and NOT an arbitrary topic's SL/HL: a course page covers both.
    expect(courseQualifier('math-dp-ai')).not.toMatch(/S[HL]|H[CL]$/);
    expect(courseQualifier('eng-ks3')).toBe('KS3 English');
    expect(courseQualifier('nope-nope')).toBeNull();
  });

  it('keeps every ladder level aligned with FREE_LADDER_LEVELS', () => {
    for (const level of LADDER_LEVELS.map((l) => l.level)) {
      const m = metaForLadderLevel('math-y7', level)!;
      expect(robotsOf(m).index).toBe(isFreeLadderLevel(level));
      expect(robotsOf(m).follow).toBe(true);
    }
  });

  it('keeps paper sets aligned with FREE_PAPER_SETS_PER_COURSE', () => {
    for (const paper of getAllPapers()) {
      const m = metaForPaperSet(paper);
      expect(robotsOf(m).index).toBe(isFreePaperSet(paper.id));
    }
  });

  it('never indexes a timed mock paper (premium in ExamRunnerClient)', () => {
    for (const course of getExamCourses()) {
      for (const paper of course.papers) {
        const m = metaForMockPaper(course.id, paper.paperId)!;
        expect(robotsOf(m).index).toBe(false);
        expect(robotsOf(m).follow).toBe(true);
      }
    }
  });

  it('indexes the free diagnostics and the ladder overview', () => {
    for (const id of ['math-y7', 'bio-ks3', 'math-dp-ai']) {
      expect(robotsOf(metaForDiagnostic(id)!).index).toBe(true);
      expect(robotsOf(metaForLadderOverview(id)!).index).toBe(true);
      expect(renderedDesc(metaForDiagnostic(id)!).length).toBeGreaterThan(60);
    }
  });
});
