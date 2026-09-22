import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Solve ax + b = c with an integer answer: draw a, b and the answer x, then
// compute c = a*x + b so every instance is exact.

export const paramsSchema = z.object({
  a: z.array(z.number()).min(1),
  b: z.array(z.number()).min(1),
  x: z.array(z.number()).min(1),
});
export type LinearEquationParams = z.infer<typeof paramsSchema>;

export interface LinearEquationValues {
  a: number;
  b: number;
  x: number;
  c: number;
}

export function draw(params: LinearEquationParams, rng: Rng): LinearEquationValues {
  const a = pick(params.a, rng);
  const b = pick(params.b, rng);
  const x = pick(params.x, rng);
  return { a, b, x, c: a * x + b };
}

export function build(values: LinearEquationValues, rng: Rng): GeneratorOutput {
  const { a, b, x, c } = values;
  const sign = b >= 0 ? '+' : '-';
  const absB = fmtNumber(Math.abs(b));
  const undo = b >= 0 ? `Subtract ${absB}` : `Add ${absB}`;
  // Error rules: adding b instead of subtracting it, and off-by-one slips.
  // The wrong-undo candidate (c + b) / a is only offered when it is a clean value
  // (at most 2 d.p.). A repeating decimal such as 8.333333 does not read as a
  // mistake a student would make and it narrows the choice to three options, so
  // those draws fall through to the near-miss padders in the helper instead.
  const wrongUndo = (c + b) / a;
  const cleanWrongUndo = Math.abs(wrongUndo * 100 - Math.round(wrongUndo * 100)) < 1e-9;
  const distractorValues = uniqueNumericDistractors(
    x,
    cleanWrongUndo ? [wrongUndo, x + 1, x - 1] : [x + 1, x - 1],
    rng
  );
  return {
    stem: `Solve $${fmtNumber(a)}x ${sign} ${absB} = ${fmtNumber(c)}$.`,
    correct: `$x = ${fmtNumber(x)}$`,
    distractors: distractorValues.map((v) => `$x = ${fmtNumber(v)}$`) as [string, string, string],
    explanation: `${undo}: $${fmtNumber(a)}x = ${fmtNumber(c - b)}$, then divide by ${fmtNumber(a)}: $x = ${fmtNumber(x)}$. Check: $${fmtNumber(a)}(${fmtNumber(x)}) ${sign} ${absB} = ${fmtNumber(c)}$ ✓.`,
  };
}

export const mathLinearEquation: QuestionGenerator<LinearEquationParams> = {
  id: 'math-linear-equation',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
