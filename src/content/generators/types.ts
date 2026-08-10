import type { ZodType } from 'zod';
import type { Difficulty } from '../types';

// Seeded PRNG (mulberry32 via createRng in src/lib/quiz-utils.ts).
export type Rng = () => number;

/**
 * Output of one template instance. The engine (src/lib/generators.ts) shuffles
 * correct + distractors and derives correctIndex, so generators never worry
 * about choice order.
 */
export interface GeneratorOutput {
  stem: string;
  correct: string;
  distractors: [string, string, string];
  /** >= 20 chars, explains the computation (validate:content enforces). */
  explanation: string;
}

/**
 * Parameterized question template (docs/question-variations-plan.md, D5/D7).
 * Each generator is a pure draw/build pair: draw picks concrete values from
 * the param table, build renders stem/choices/explanation from them — so unit
 * tests can feed edge-case values straight into build.
 */
export interface QuestionGenerator<P = unknown> {
  /** kebab-case, matches the registry key and the topic JSON `generator` field. */
  id: string;
  /** Fixed per template (D7); must match the difficulty of any group it joins. */
  difficulty: Difficulty;
  /** Validates the per-topic params table from the topic JSON. */
  paramsSchema: ZodType<P>;
  generate(params: P, rng: Rng): GeneratorOutput;
}
