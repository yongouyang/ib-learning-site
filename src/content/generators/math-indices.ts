import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, uniqueDistractors } from './utils';

// Index laws: multiplying and dividing powers of the same base, and a power of a
// power. Serves the index/power topics and any topic that manipulates powers
// (algebraic manipulation, standard form, surds). Answers are LaTeX, matching the
// authored maths content: `$x^{13}$`, `$\dfrac{a^{10}}{a^{4}}$`.
//
// The distractors are the three laws applied to the wrong operation — the error a
// student actually makes is adding when they should multiply, or vice versa — so
// each wrong choice is the result of a specific, nameable mistake.

export const paramsSchema = z.object({
  /** Bases to use, e.g. ["x", "a", "y"]. */
  symbols: z.array(z.string().min(1)).min(1),
  /** Exponents to draw from. Keep them >= 2 so no answer reads as $x^{1}$. */
  exponents: z.array(z.number().int().min(2).max(9)).min(2),
  /** Which laws to ask about. */
  ops: z.array(z.enum(['multiply', 'divide', 'power'])).min(1).default(['multiply', 'divide', 'power']),
});
export type IndicesParams = z.infer<typeof paramsSchema>;

export interface IndicesValues {
  symbol: string;
  op: 'multiply' | 'divide' | 'power';
  /** First exponent (the base power for `power`). */
  m: number;
  /** Second exponent (the outer power for `power`). */
  n: number;
  answerExponent: number;
}

export function draw(params: IndicesParams, rng: Rng): IndicesValues {
  const symbol = pick(params.symbols, rng);
  const op = pick(params.ops, rng);
  const [a, b] = params.exponents.length >= 2 ? [pick(params.exponents, rng), pick(params.exponents, rng)] : [2, 3];
  // Division must stay positive-exponent: draw the larger one first.
  const m = op === 'divide' ? Math.max(a, b) : a;
  const n = op === 'divide' ? Math.min(a, b) : b;
  const single = op === 'divide' && m === n;
  const answerExponent =
    op === 'multiply' ? m + n : op === 'divide' ? m - n : m * n;
  if (single && answerExponent === 0) {
    // x^2 / x^2 would give x^0; the params table should avoid this, but a
    // duplicate draw can still produce it, so nudge deterministically.
    return { symbol, op: 'multiply', m, n, answerExponent: m + n };
  }
  return { symbol, op, m, n, answerExponent };
}

function power(symbol: string, exponent: number): string {
  // Render the simplified form: x^1 is just x, and x^0 is 1. Emitting `$x^{1}$`
  // in a "simplify" question would be wrong on its own terms.
  if (exponent === 1) return `$${symbol}$`;
  if (exponent === 0) return '$1$';
  return `$${symbol}^{${exponent}}$`;
}

export function build(values: IndicesValues, rng: Rng): GeneratorOutput {
  const { symbol, op, m, n, answerExponent } = values;
  const correct = power(symbol, answerExponent);

  let stem: string;
  let candidates: string[];
  let law: string;
  let named: string;

  if (op === 'multiply') {
    // One math span, not two: `$x^{3}$ \\times $x^{4}$` would render the
    // \\times as literal text between two separate inline spans.
    stem = `Simplify $${symbol}^{${m}} \\times ${symbol}^{${n}}$.`;
    const multiplied = power(symbol, m * n);
    candidates = [multiplied, power(symbol, m + n + 1), power(symbol, Math.abs(m - n)), power(symbol, m + n - 1)];
    law = `When you multiply powers of the same base, you add the exponents: $${symbol}^{${m}} \\times ${symbol}^{${n}} = ${symbol}^{${m}+${n}} = ${symbol}^{${answerExponent}}$.`;
    named = multiplied;
  } else if (op === 'divide') {
    stem = `Simplify $\\dfrac{${symbol}^{${m}}}{${symbol}^{${n}}}$.`;
    const added = power(symbol, m + n);
    // No `n - m` candidate: that yields a negative exponent ($x^{-3}$), which is
    // off-level for the KS3/IGCSE topics this serves.
    candidates = [added, power(symbol, m - n + 1), power(symbol, m - n - 1), power(symbol, m - n + 2)];
    law = `When you divide powers of the same base, you subtract the exponents: $\\dfrac{${symbol}^{${m}}}{${symbol}^{${n}}} = ${symbol}^{${m}-${n}} = ${symbol}^{${answerExponent}}$.`;
    named = added;
  } else {
    stem = `Simplify $(${symbol}^{${m}})^{${n}}$.`;
    const added = power(symbol, m + n);
    candidates = [added, power(symbol, m * n + 1), power(symbol, m * n - 1), power(symbol, m + n + 1)];
    law = `A power of a power multiplies the exponents: $(${symbol}^{${m}})^{${n}} = ${symbol}^{${m} \\times ${n}} = ${symbol}^{${answerExponent}}$.`;
    named = added;
  }

  const fallback = [
    power(symbol, answerExponent + 1),
    power(symbol, Math.max(1, answerExponent - 1)),
    power(symbol, answerExponent + 2),
    power(symbol, m),
    power(symbol, n),
  ];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);
  const note = distractors.includes(named)
    ? op === 'power'
      ? ` The ${named} option adds the exponents instead of multiplying them.`
      : ` The ${named} option applies the wrong law.`
    : '';

  return {
    stem,
    correct,
    distractors,
    explanation: `${law}${note}`,
  };
}

export const mathIndices: QuestionGenerator<IndicesParams> = {
  id: 'math-indices',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
