import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, shuffle, uniqueDistractors } from './utils';

// Term/definition matching, fed by the TOPIC'S OWN FLASHCARDS rather than by a
// params table: the template declares `source: "flashcards"` and the engine injects
// the deck as `params.cards` (src/lib/generators.ts#withSourceTable). The deck is the
// single source of truth, so a drill can never drift from the cards it drills, and a
// subject with no skill generator (language vocabulary, terminological recall in
// history/geography/ICT/biology) still gets fresh variants on every retake.
//
// This is a RECALL drill, not a skill generator: it tests the same content the deck
// teaches, in the two directions (term -> meaning, meaning -> term). Both directions
// matter for the language decks, where one is comprehension and the other production.
//
// Readability is the constraint that shapes the design: choices are drawn only from
// cards whose term and definition are at most `maxLength` characters, so a question
// never turns into four paragraphs. If a deck cannot supply enough short cards the
// FOUR SHORTEST are used instead — deterministic, and it means a small or verbose deck
// cannot throw at session time (validation cannot know the deck, because it is content
// the params table does not carry).

const DIRECTIONS = ['term-to-definition', 'definition-to-term'] as const;

export const paramsSchema = z.object({
  /** Injected by the engine from the topic's flashcards — never authored in JSON. */
  cards: z
    .array(z.object({ term: z.string().min(1), definition: z.string().min(1) }))
    .min(4, 'flashcard-match: a topic needs at least 4 flashcards to build a matching question'),
  direction: z.array(z.enum(DIRECTIONS)).min(1).default(['term-to-definition']),
  /** Cards longer than this (either side) are not offered as choices. */
  maxLength: z.number().int().min(20).max(300).default(140),
});
export type FlashcardMatchParams = z.infer<typeof paramsSchema>;

type Direction = (typeof DIRECTIONS)[number];

export interface FlashcardMatchValues {
  direction: Direction;
  term: string;
  definition: string;
  distractors: [string, string, string];
}

function usable(params: FlashcardMatchParams, direction: Direction): { term: string; definition: string }[] {
  // Only the side that becomes a CHOICE is length-capped: the question side appears once,
  // so a long definition is fine in the stem but four of them would be a wall of text. That
  // is what lets a prose deck (200-character definitions, short terms) still drill — in the
  // definition-to-term direction, where the choices are the terms.
  //
  // Cards carrying a literal `$` are dropped either way: the house style reserves `$` for
  // inline maths in these subjects, and InlineMath would read a raw one as a delimiter.
  const answerOf = (card: { term: string; definition: string }) =>
    direction === 'term-to-definition' ? card.definition : card.term;
  const clean = params.cards.filter((card) => !card.term.includes('$') && !card.definition.includes('$'));
  const shortEnough = clean.filter((card) => answerOf(card).length <= params.maxLength);
  if (shortEnough.length >= 4) return shortEnough;
  // Fall back to the four shortest answers so a small or verbose deck still produces a
  // question: deterministic, and the schema guarantees at least 4 cards exist.
  return [...clean]
    .sort((a, b) => answerOf(a).length - answerOf(b).length)
    .slice(0, 4);
}

export function draw(params: FlashcardMatchParams, rng: Rng): FlashcardMatchValues {
  const direction = pick(params.direction ?? ['term-to-definition'], rng);
  const pool = usable(params, direction);
  const correctCard = pick(pool, rng);
  const answerOf = (card: { term: string; definition: string }) =>
    direction === 'term-to-definition' ? card.definition : card.term;

  const others = shuffle(
    pool.filter((card) => card.term !== correctCard.term && card.definition !== correctCard.definition),
    rng
  );
  const distractors = [...new Set(others.map(answerOf))].filter((text) => text !== answerOf(correctCard)).slice(0, 3);
  if (distractors.length < 3) {
    throw new Error('flashcard-match: the deck does not offer 3 distinct alternative answers — add more flashcards');
  }
  return {
    direction,
    term: correctCard.term,
    definition: correctCard.definition,
    distractors: distractors as [string, string, string],
  };
}

export function build(values: FlashcardMatchValues, rng: Rng): GeneratorOutput {
  const { direction, term, definition, distractors } = values;
  const correct = direction === 'term-to-definition' ? definition : term;
  const stem =
    direction === 'term-to-definition'
      ? `What is ${term}?`
      : `Which term means "${definition}"?`;
  // uniqueDistractors re-checks the four choices are distinct strings (the draw already
  // guarantees it, but this keeps the invariant in one place for every generator).
  const checked = uniqueDistractors(correct, [...distractors], [`Not ${correct}`, `None of these`], rng);
  return {
    stem,
    correct,
    distractors: checked,
    // Phrased rather than dashed: a short vocabulary pair ("der Hund" / "the dog") made a
    // bare "term — definition" explanation under the 20-character minimum, which
    // validate:content rejects for real decks (found by its sweep over this generator).
    explanation:
      direction === 'term-to-definition'
        ? `${term} is defined as: ${definition}${/[.?!]$/.test(definition) ? '' : '.'}`
        : `The term for "${definition}" is ${term}.`,
  };
}

export const flashcardMatch: QuestionGenerator<FlashcardMatchParams> = {
  id: 'flashcard-match',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
