import type { Metadata } from 'next';
import type { Subject, Topic } from '@/content/types';
import { SITE } from './site';
import { STUDY_PATH, TIERS, curriculumLabel, tierOfTopic } from './curriculum';
import { clipToWidth, displayWidth, plainText } from './text';

/**
 * Title/description derivation for every indexable page. One module so the sitemap,
 * the <title>, the meta description and the JSON-LD can never disagree — measured
 * against the live 217-topic corpus: max title width 60, only 20/217 clipped.
 */

/** Google truncates by pixel width; ~600px ≈ 60 cells of our font. */
const TITLE_BUDGET = 60;
/** Budget for the noindex /quiz + /flashcards variants (never shown in a SERP). */
const TOOL_TITLE_BUDGET = 75;
/** Descriptions past ~155 chars are truncated in the desktop SERP. */
const DESC_BUDGET = 158;
/** Appended by the root layout's `title.template` ('%s · Octav Learning') on hub pages. */
const BRAND_SUFFIX = ` · ${SITE.name}`;

/**
 * SERP copy only — the UI keeps `subjects.json` names verbatim. UK and Gulf students
 * search "KS3 maths" / "IGCSE maths" (plural); the corpus is UK-curriculum, so the
 * meta layer uses the plural while the product says "Math".
 */
export function subjectSeoName(name: string): string {
  return name === 'Math' ? 'Maths' : name;
}

/** Tiers this subject actually has content in, in curriculum order — never hardcoded. */
export function subjectTierLabels(subject: Subject): string[] {
  const present = new Set(subject.topics.map((t) => tierOfTopic(t)));
  return (['ks3', 'igcse', 'ibdp'] as const).filter((t) => present.has(t)).map((t) => TIERS[t].label);
}

/**
 * "KS3 Year 7 Maths" | "KS3 English" | "IGCSE Biology" | "IB DP Maths AI SL".
 * `includeLevel` is off for COURSE-level labels ("IB DP Maths AI"), where SL/HL belongs to
 * the individual topic — picking the first topic's level would stamp an arbitrary SL/HL
 * onto a page that covers both.
 */
export function titleQualifier(topic: Topic, subjectName: string, includeLevel = true): string {
  const subject = subjectSeoName(subjectName);
  if (topic.stage === 'ks3') return topic.year ? `KS3 Year ${topic.year} ${subject}` : `KS3 ${subject}`;
  if (topic.stage === 'igcse') return `IGCSE ${subject}`;
  const course = topic.course ? ` ${topic.course.toUpperCase()}` : '';
  const level = includeLevel && topic.level ? ` ${topic.level.toUpperCase()}` : '';
  return `IB DP ${subject}${course}${level}`;
}

/**
 * Brand-free, keyword-tail-anchored: "<topic> — KS3 Year 7 Maths", or
 * "<topic> quiz — KS3 Year 7 Maths" for the tool variants. Clipping is applied to the
 * TOPIC half only, because the curriculum tail is the part that carries the query intent
 * ("KS3", "Year 7", "IB DP AI") and must survive.
 */
function composeTopicTitle(topic: Topic, subjectName: string, label?: string, budget = TITLE_BUDGET): string {
  const qualifier = titleQualifier(topic, subjectName);
  const suffix = `${label ? ` ${label}` : ''} — ${qualifier}`;
  const room = Math.max(16, budget - displayWidth(suffix));
  return `${clipToWidth(plainText(topic.title), room)}${suffix}`;
}

/** Counts sentence, built first so it is never the thing that gets clipped away. */
function countsSentence(topic: Topic): string {
  return `${topic.notes.length} illustrated notes, ${topic.flashcards.length} flashcards and ${topic.questions.length} practice questions with answers.`;
}

function topicDescription(topic: Topic, lead: string): string {
  const counts = countsSentence(topic);
  const room = Math.max(24, DESC_BUDGET - displayWidth(counts) - 1);
  return `${clipToWidth(plainText(lead), room)} ${counts}`;
}

const OPEN_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  'max-snippet': -1,
  'max-image-preview': 'large',
};

function ogWithBrand(title: string, description: string, path: string): Metadata['openGraph'] {
  return {
    type: 'website',
    url: `${SITE.origin}${path}`,
    // og:title is NOT run through the layout template, so the brand is added here.
    title: `${title} · ${SITE.name}`,
    description,
    siteName: SITE.name,
  };
}

/** The indexed canonical leaf: /subjects/<subject>/<topic>/study */
export function metaForTopic(topic: Topic, subjectName: string): Metadata {
  const path = STUDY_PATH(topic);
  const title = composeTopicTitle(topic, subjectName);
  const description = topicDescription(
    topic,
    `${topic.description} Study ${curriculumLabel(topic)} ${subjectSeoName(subjectName)} on Octav Learning.`,
  );
  return {
    // absolute: the deep pages are long-tail keyword landers, so every cell goes to the
    // topic + curriculum and none is spent repeating the brand (Google adds the site
    // name itself where it wants it). Hubs keep the templated brand.
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: OPEN_ROBOTS,
    openGraph: ogWithBrand(title, description, path),
    twitter: { card: 'summary', title, description },
  };
}

/**
 * /quiz and /flashcards: interactive variants of the same topic. They carry almost no
 * unique prose, so letting 434 of them into the index would make them compete with the
 * 217 study pages. noindex but FOLLOW — the pages stay crawlable, so the directive is
 * readable and the links keep passing equity to /study (a robots.txt Disallow would
 * strand them as "Indexed, though blocked").
 */
export function metaForTool(topic: Topic, subjectName: string, tool: 'quiz' | 'flashcards'): Metadata {
  const isQuiz = tool === 'quiz';
  const qualifier = titleQualifier(topic, subjectName);
  // noindex page → TOOL_TITLE_BUDGET instead of the SERP budget: nothing truncates it in a
  // search snippet, so the whole topic name is worth keeping for the tab and history list.
  const qualified = composeTopicTitle(topic, subjectName, isQuiz ? 'quiz' : 'flashcards', TOOL_TITLE_BUDGET);
  const description = isQuiz
    ? topicDescription(topic, `Test yourself on ${plainText(topic.title)} with ${topic.questions.length} ${qualifier} questions, instant marking and worked explanations.`)
    : topicDescription(topic, `Learn ${plainText(topic.title)} with ${topic.flashcards.length} ${qualifier} flashcards, graded by what you already know.`);
  return {
    title: { absolute: qualified },
    description,
    // canonical points at the study page: belt-and-braces with noindex, and it makes
    // the engine's preferred-URL choice match ours even if the directive is ignored.
    alternates: { canonical: STUDY_PATH(topic) },
    robots: { index: false, follow: true },
    openGraph: ogWithBrand(qualified, description, STUDY_PATH(topic)),
    twitter: { card: 'summary', title: qualified, description },
  };
}

/** /subjects/<subjectId> — the cross-curriculum subject index (Y7 → IB DP in one place). */
export function metaForSubject(subject: Subject): Metadata {
  const subjectSeo = subjectSeoName(subject.name);
  const tierLabels = subjectTierLabels(subject);
  const tiers = subject.topics.map((t) => tierOfTopic(t));
  const path = `/subjects/${subject.id}`;
  const stages = subject.topics.filter((t) => t.stage === 'ks3').length;
  const years = [...new Set(subject.topics.filter((t) => t.year).map((t) => `Year ${t.year}`))].sort();
  const title = clipToWidth(
    `${subjectSeo} revision notes — ${tierLabels.join(' & ')}`,
    TITLE_BUDGET - displayWidth(BRAND_SUFFIX),
  );
  const description = clipToWidth(
    plainText(
      `${subject.topics.length} ${subjectSeo} topics for international-school students: ${stages} KS3${years.length ? ` (${years.join(', ')})` : ''}${tiers.includes('ibdp') ? `, plus the IB DP ${subjectSeo} unit` : ''}. Every topic has illustrated notes, flashcards and a marked quiz, free to start.`,
    ),
    DESC_BUDGET,
  );
  return {
    title, // templated → "<title> · Octav Learning"
    description,
    alternates: { canonical: path },
    robots: OPEN_ROBOTS,
    openGraph: ogWithBrand(title, description, path),
    twitter: { card: 'summary', title: `${title} · ${SITE.name}`, description },
  };
}
