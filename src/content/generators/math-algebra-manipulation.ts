import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, uniqueDistractors } from './utils';

// Algebraic manipulation: expanding a single bracket, taking out a common factor,
// expanding two binomials, factorising a monic quadratic, and the difference of two
// squares. The quadratic modes are generated FROM ITS FACTORS, so the factorised
// answer is exact by construction and can never disagree with the expanded stem.
//
// Distractors are the named errors: not distributing over the second term
// (`3x + 2` for 3(x + 2)), taking the constant out of the bracket as well,
// swapping the middle coefficient and the constant in an expansion, and sign slips
// in a factorisation.

const MODES = [
  'expand-bracket',
  'factorise-common',
  'expand-binomials',
  'factorise-quadratic',
  'difference-of-squares',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Variable symbols, e.g. ["x", "y"]. */
  symbols: z.array(z.string().min(1)).min(1).default(['x']),
  /** Coefficients for the single-bracket modes. */
  coefficients: z.array(z.number().int().min(2).max(9)).min(1),
  /** The other factor (the bracket's constant, or the second root). */
  constants: z.array(z.number().int().min(1).max(12)).min(1),
  /** Allow minus signs (a `- b` bracket, a negative second root). */
  negatives: z.boolean().default(true),
});
export type AlgebraManipulationParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface AlgebraValues {
  mode: Mode;
  symbol: string;
  a: number;
  b: number;
  negative: boolean;
}

export function draw(params: AlgebraManipulationParams, rng: Rng): AlgebraValues {
  // Normalise the schema defaults here too (plain objects reach draw() in tests).
  const modes = params.modes ?? [...MODES];
  const negatives = params.negatives ?? true;
  return {
    mode: pick(modes, rng),
    symbol: pick(params.symbols ?? ['x'], rng),
    a: pick(params.coefficients, rng),
    b: pick(params.constants, rng),
    negative: negatives ? rng() < 0.4 : false,
  };
}

const sign = (negative: boolean) => (negative ? '-' : '+');

/** `3x + 6`, `3x - 6`, `x`, `-x`. */
function linear(a: number, b: number, symbol: string): string {
  const coefficient = a === 1 ? '' : a === -1 ? '-' : String(a);
  const term = `${coefficient}${symbol}`;
  if (b === 0) return term;
  return `${term} ${b > 0 ? '+' : '-'} ${Math.abs(b)}`;
}

/** `(x + 4)`, `(x - 4)`. */
function binomial(b: number, symbol: string): string {
  return `(${linear(1, b, symbol)})`;
}

/** `x^2 + 7x + 10` from the roots -p and -q (monic, factors (x + p)(x + q)). */
function quadratic(p: number, q: number, symbol: string): string {
  const middle = p + q;
  const constant = p * q;
  let out = `${symbol}^2`;
  if (middle !== 0) out += ` ${middle > 0 ? '+' : '-'} ${linear(Math.abs(middle), 0, symbol)}`;
  if (constant !== 0) out += ` ${constant > 0 ? '+' : '-'} ${Math.abs(constant)}`;
  return out;
}

export function build(values: AlgebraValues, rng: Rng): GeneratorOutput {
  const { mode, symbol, a, b, negative } = values;
  const s = sign(negative);
  const signedB = negative ? -b : b;

  let stem: string;
  let correct: string;
  let candidates: string[];
  let fallback: string[];
  let explanation: string;

  if (mode === 'expand-bracket') {
    correct = `$${linear(a, a * signedB, symbol)}$`;
    stem = `Expand $${a}(${linear(1, signedB, symbol)})$.`;
    candidates = [
      `$${linear(a, signedB, symbol)}$`,
      `$${linear(a + 1, a * signedB, symbol)}$`,
      `$${linear(a, -a * signedB, symbol)}$`,
      `$${linear(a, b, symbol)}$`,
    ];
    fallback = [`$${linear(a + 2, a * signedB, symbol)}$`, `$${linear(a, a * signedB + a, symbol)}$`];
    explanation = `Multiply BOTH terms in the bracket by ${a}: $${a} \\times ${symbol} = ${a === 1 ? '' : a}${symbol}$ and $${a} \\times ${b} = ${a * b}$. ${negative ? 'The bracket is subtracted, so the second term is negative' : 'Both terms are positive'}, giving $${linear(a, a * signedB, symbol)}$.`;
  } else if (mode === 'factorise-common') {
    correct = `$${a}(${linear(1, signedB, symbol)})$`;
    stem = `Factorise $${linear(a, a * signedB, symbol)}$.`;
    candidates = [
      `$${a}(${linear(1, a * signedB, symbol)})$`,
      `$${symbol}(${a} ${s} ${b})$`,
      `$${a + 1}(${linear(1, signedB, symbol)})$`,
      `$${a}${symbol}(${linear(1, signedB, symbol)})$`,
    ];
    fallback = [
      `$${a}(${linear(1, b, symbol)})$`,
      `$${a}(${linear(1, -signedB, symbol)})$`,
      `$${a * 2}(${linear(1, signedB, symbol)})$`,
    ];
    explanation = `The highest common factor of $${a}${symbol}$ and $${a * b}$ is $${a}$, so $${linear(a, a * signedB, symbol)} = ${a}(${linear(1, signedB, symbol)})$.`;
  } else if (mode === 'expand-binomials') {
    const p = b;
    const q = negative ? -Math.max(1, b - 2) : b + 1;
    correct = `$${quadratic(p, q, symbol)}$`;
    stem = `Expand $${binomial(p, symbol)}${binomial(q, symbol)}$.`;
    const middle = p + q;
    const constant = p * q;
    candidates = [
      `$${quadratic(constant, middle, symbol)}$`,
      `$${quadratic(p, -q, symbol)}$`,
      `$${quadratic(-p, -q, symbol)}$`,
      `$${quadratic(middle, constant, symbol)}$`,
    ];
    fallback = [`$${quadratic(p + 1, q, symbol)}$`, `$${quadratic(p, q + 1, symbol)}$`];
    const signed = (n: number) => (n < 0 ? `(${n})` : String(n));
    explanation = `Multiply every term of the first bracket by every term of the second: $${quadratic(p, q, symbol)}$, from $${signed(p)} \\times ${signed(q)} = ${constant}$ and $${signed(p)} + ${signed(q)} = ${middle}$.`;
  } else if (mode === 'factorise-quadratic') {
    const p = b;
    const q = negative ? -Math.max(1, b - 2) : b + 1;
    correct = `$${binomial(p, symbol)}${binomial(q, symbol)}$`;
    stem = `Factorise $${quadratic(p, q, symbol)}$.`;
    candidates = [
      `$${binomial(p, symbol)}${binomial(p, symbol)}$`,
      `$${binomial(-p, symbol)}${binomial(-q, symbol)}$`,
      `$${binomial(p + 1, symbol)}${binomial(q - 1, symbol)}$`,
      `$${binomial(p + q, symbol)}${binomial(1, symbol)}$`,
    ];
    fallback = [
      `$${binomial(p, symbol)}${binomial(q + 1, symbol)}$`,
      `$${binomial(p - 1, symbol)}${binomial(q + 1, symbol)}$`,
      `$${binomial(-p, symbol)}${binomial(q, symbol)}$`,
    ];
    const signed = (n: number) => (n < 0 ? `(${n})` : String(n));
    explanation = `We need two numbers that multiply to $${signed(p * q)}$ and add to $${signed(p + q)}$: $${signed(p)}$ and $${signed(q)}$. So $${quadratic(p, q, symbol)} = ${binomial(p, symbol)}${binomial(q, symbol)}$.`;
  } else {
    const k = b;
    correct = `$${binomial(k, symbol)}${binomial(-k, symbol)}$`;
    stem = `Factorise $${symbol}^2 - ${k * k}$.`;
    candidates = [
      `$${binomial(k, symbol)}${binomial(k, symbol)}$`,
      `$${binomial(-k, symbol)}${binomial(-k, symbol)}$`,
      `$${binomial(k * k, symbol)}$`,
      `$${binomial(k, symbol)}${binomial(-1, symbol)}$`,
    ];
    fallback = [`$${binomial(k + 1, symbol)}${binomial(-k, symbol)}$`, `$${binomial(k, symbol)}${binomial(-(k + 1), symbol)}$`];
    explanation = `A difference of two squares factors as $${symbol}^2 - k^2 = (${symbol} + k)(${symbol} - k)$, so $${symbol}^2 - ${k * k} = ${binomial(k, symbol)}${binomial(-k, symbol)}$.`;
  }

  return { stem, correct, distractors: uniqueDistractors(correct, candidates, fallback, rng), explanation };
}

export const mathAlgebraManipulation: QuestionGenerator<AlgebraManipulationParams> = {
  id: 'math-algebra-manipulation',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
