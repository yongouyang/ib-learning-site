import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Substitution: evaluate `ax + b` or `ax^2 + b` at a drawn value of the variable.
// This is the mirror of math-linear-equation (solve for x) and the skill behind
// function notation — `f(3)` is this question with different clothing — so the
// variable symbol comes from the params table and the corpus' own wording ("If
// $x = 4$, what is $3x + 7$?") is reused verbatim.
//
// Negative inputs are included deliberately: they are the whole point, because
// `2(-3) + 7` and `2(-4)^2 + 3` are where the sign and order-of-operations
// errors live. The distractors are exactly those mistakes — squaring the sign
// (`-16` for `(-4)^2`), applying the exponent to the coefficient (which is a
// different question), treating the quadratic as linear, and slipping by one.

export const paramsSchema = z.object({
  /** Variable symbols to use, e.g. ["x", "y", "n"]. */
  symbols: z.array(z.string().min(1)).min(1).default(['x']),
  /** Coefficients of the variable (always positive; the sign error comes from the input). */
  coefficients: z.array(z.number().int().min(1).max(9)).min(1),
  /** Constant terms — negative values give `3x - 5`. */
  constants: z.array(z.number().int().min(-9).max(20)).min(1),
  /** Values of the variable to substitute, e.g. [-4, -3, 2, 3, 4, 5]. */
  values: z.array(z.number().int().min(-9).max(9)).min(1),
  modes: z.array(z.enum(['linear', 'quadratic'])).min(1).default(['linear', 'quadratic']),
});
export type SubstitutionParams = z.infer<typeof paramsSchema>;

type Mode = 'linear' | 'quadratic';

export interface SubstitutionValues {
  mode: Mode;
  symbol: string;
  a: number;
  b: number;
  x: number;
}

export function draw(params: SubstitutionParams, rng: Rng): SubstitutionValues {
  // Normalise the schema defaults here too — draw() is called with a plain object
  // by unit tests and future callers.
  return {
    mode: pick(params.modes ?? ['linear', 'quadratic'], rng),
    symbol: pick(params.symbols ?? ['x'], rng),
    a: pick(params.coefficients, rng),
    b: pick(params.constants, rng),
    x: pick(params.values, rng),
  };
}

/** `3x + 7`, `3x - 7`, `x + 7`, `3x`. */
function expression(symbol: string, a: number, b: number, squared: boolean): string {
  const coefficient = a === 1 ? '' : String(a);
  const variable = squared ? `${symbol}^2` : symbol;
  const constant = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`;
  return `$${coefficient}${variable}${constant}$`;
}

export function build(values: SubstitutionValues, rng: Rng): GeneratorOutput {
  const { mode, symbol, a, b, x } = values;
  const squared = mode === 'quadratic';
  const power = squared ? x * x : x;
  const product = a * power;
  const answer = product + b;

  const stem = `If $${symbol} = ${x}$, what is ${expression(symbol, a, b, squared)}?`;
  const candidates = squared
    ? [-a * (x * x) + b, a * x + b, (a * x) ** 2 + b, answer + 1]
    : [a * x - b, a * (x + b), -a * x + b, answer + a];
  const distractors = uniqueNumericDistractors(answer, candidates, rng).map((v) =>
    fmtNumber(v)
  ) as [string, string, string];

  const sign = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`;
  const coefficient = a === 1 ? '' : String(a);
  const squareNote = `The square applies to $${symbol}$ alone${a === 1 ? '' : `, before multiplying by $${a}$`}.`;
  const explanation = squared
    ? `Substitute $${symbol} = ${x}$: $${coefficient}(${x})^2${sign} = ${a === 1 ? '' : `${a} \\times `}${fmtNumber(power)}${sign} = ${fmtNumber(answer)}$. ${squareNote}`
    : `Substitute $${symbol} = ${x}$: $${coefficient}(${x})${sign} = ${fmtNumber(product)}${sign} = ${fmtNumber(answer)}$.`;

  return { stem, correct: fmtNumber(answer), distractors, explanation };
}

export const mathSubstitution: QuestionGenerator<SubstitutionParams> = {
  id: 'math-substitution',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
