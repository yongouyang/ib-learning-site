import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors } from './utils';

// Quadratic equations: solve by the formula, read the discriminant, say how many
// real roots a discriminant gives, complete the square, and build an equation from
// its roots.
//
// Every instance is CONSTRUCTED, so the arithmetic in the stem is exact:
//  - the solving and equation-from-roots modes start from two integer roots, so the
//    discriminant is a perfect square and the answers are exact rationals;
//  - completing the square starts from an integer (p, q) with b = 2p;
//  - the discriminant modes draw b and c directly, which is what makes all three
//    signs (positive, zero, negative -> two roots / one repeated root / no real roots)
//    actually reachable. Deriving them from roots or from (p, q) makes the
//    discriminant a square or a multiple of -4 and the "no real roots" case
//    unreachable — the first draft of this file had exactly that defect.
//
// NOT mechanized here, deliberately: irrational roots and "leave your answer in surd
// form" items, which need surd simplification (a different generator).
//
// Distractors are the named errors: flipping the sign of both roots, offering a
// single root (the +/- discarded), using b instead of b/2 when completing the square,
// dropping the -4ac term, and sign slips in the equation built from roots.

const MODES = ['solve-formula', 'discriminant', 'roots-count', 'complete-square', 'equation-from-roots'] as const;

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Root magnitudes and (p, q) values to build from. */
    roots: z.array(z.number().int().min(1).max(12)).min(2),
    /** Leading coefficients for the solving mode. */
    coefficients: z.array(z.number().int().min(1).max(4)).min(1).default([1]),
    /** Whether roots and p may be negative. */
    negatives: z.boolean().default(true),
  })
  .refine((p) => new Set(p.roots).size >= 2, {
    message: 'math-quadratic: roots needs at least two distinct magnitudes, or the two roots can coincide',
  });
export type QuadraticParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface QuadraticValues {
  mode: Mode;
  a: number;
  /** Roots with sign (the solve-formula and equation-from-roots modes). */
  r1: number;
  r2: number;
  /** Completing the square: (x + p)^2 + q. */
  p: number;
  q: number;
  /** Coefficients of ax^2 + bx + c. */
  b: number;
  c: number;
}

function signedTerm(value: number, suffix = ''): string {
  if (value === 0) return '';
  return value > 0 ? ` + ${value}${suffix}` : ` - ${Math.abs(value)}${suffix}`;
}

/** The x-term only: `+ x`, `- x`, `+ 5x` — never `+ 1x`. */
function xTerm(value: number): string {
  if (value === 0) return '';
  const magnitude = Math.abs(value) === 1 ? '' : String(Math.abs(value));
  return value > 0 ? ` + ${magnitude}x` : ` - ${magnitude}x`;
}

/** `x^2 + 5x - 14 = 0` — inner text, callers wrap it in `$...$`. */
function quadratic(a: number, b: number, c: number, withZero = true): string {
  const lead = a === 1 ? '' : String(a);
  return `${lead}x^2${xTerm(b)}${signedTerm(c)}${withZero ? ' = 0' : ''}`;
}

/** `(x + 4)^2 - 6` — inner text. */
function completedSquare(p: number, q: number): string {
  return `(x ${p > 0 ? '+' : '-'} ${Math.abs(p)})^2${signedTerm(q)}`;
}

export function draw(params: QuadraticParams, rng: Rng): QuadraticValues {
  // Normalise the schema defaults here too (plain objects reach draw() in tests).
  const modes = params.modes ?? [...MODES];
  const negatives = params.negatives ?? true;
  const coefficients = params.coefficients ?? [1];
  const mode = pick(modes, rng);
  const a = pick(coefficients, rng);

  const first = pick(params.roots, rng);
  const rest = params.roots.filter((v) => v !== first);
  const second = pick(rest.length > 0 ? rest : params.roots, rng);
  const r1 = negatives && rng() < 0.45 ? -first : first;
  const r2 = negatives && rng() < 0.45 ? -second : second;
  const p = (negatives && rng() < 0.4 ? -1 : 1) * pick(params.roots, rng);
  // q = 0 is included so completing the square can be exact and the discriminant can be zero.
  const q = pick([-12, -9, -6, -4, -1, 0, 1, 4, 6, 9, 12], rng);

  if (mode === 'solve-formula' || mode === 'equation-from-roots') {
    return { mode, a, r1, r2, p, q, b: -a * (r1 + r2), c: a * r1 * r2 };
  }
  if (mode === 'complete-square') {
    return { mode, a: 1, r1, r2, p, q, b: 2 * p, c: p * p + q };
  }
  // Discriminant modes: b and c drawn directly, so b^2 - 4ac can be positive, zero or negative.
  const b = pick([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const c = pick([-9, -8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8, 9], rng);
  return { mode, a: 1, r1, r2, p, q, b, c };
}

export function build(values: QuadraticValues, rng: Rng): GeneratorOutput {
  const { mode, a, r1, r2, p, q, b, c } = values;

  if (mode === 'solve-formula') {
    const [low, high] = [r1, r2].sort((x, y) => x - y);
    const stem = `Solve $${quadratic(a, b, c)}$ using the quadratic formula.`;
    const correct = `$x = ${low}$ or $x = ${high}$`;
    const candidates = [
      `$x = ${-low}$ or $x = ${-high}$`,
      `$x = ${-low}$ or $x = ${high}$`,
      `$x = ${low}$`,
      `$x = ${low}$ or $x = ${high + 1}$`,
    ];
    const fallback = [
      `$x = ${low}$ or $x = ${-high}$`,
      `$x = ${high}$`,
      `$x = ${-low}$ or $x = ${-high + 1}$`,
    ];
    const distractors = uniqueDistractors(correct, candidates, fallback, rng);
    const discriminant = b * b - 4 * a * c;
    const fourAC = 4 * a * c;
    const explanation = `Discriminant $= b^2 - 4ac = ${b * b} ${fourAC < 0 ? '+' : '-'} ${Math.abs(fourAC)} = ${discriminant}$, so $x = \\dfrac{${-b} \\pm \\sqrt{${discriminant}}}{${2 * a}}$, giving $x = ${low}$ and $x = ${high}$.`;
    return { stem, correct, distractors, explanation };
  }

  if (mode === 'discriminant') {
    const discriminant = b * b - 4 * a * c;
    const stem = `What is the discriminant of $${quadratic(a, b, c)}$?`;
    const correct = fmtNumber(discriminant);
    const candidates = [b * b + 4 * a * c, b * b - 4 * a * c + 4 * a * c, 4 * a * c - b * b, discriminant + 4 * a * c];
    const fallback = [discriminant + 1, discriminant - 1, b * b + 4 * a * c + 1, discriminant * 2];
    const distractors = uniqueDistractors(correct, candidates.map(fmtNumber), fallback.map(fmtNumber), rng);
    const reading =
      discriminant > 0
        ? 'It is positive, so there are two distinct real roots.'
        : discriminant === 0
          ? 'It is zero, so there is one repeated root.'
          : 'It is negative, so there are no real roots.';
    const fourAC = 4 * a * c;
    return {
      stem,
      correct,
      distractors,
      explanation: `The discriminant is $b^2 - 4ac = (${b})^2 - 4 \\times ${a} \\times ${c} = ${b * b} ${fourAC < 0 ? '+' : '-'} ${Math.abs(fourAC)} = ${discriminant}$. ${reading}`,
    };
  }

  if (mode === 'roots-count') {
    const discriminant = b * b - 4 * a * c;
    const stem = `A quadratic equation has discriminant $${discriminant}$. How many real roots does it have?`;
    const correct =
      discriminant > 0 ? 'Two distinct real roots' : discriminant === 0 ? 'One repeated real root' : 'No real roots';
    const others = ['Two distinct real roots', 'One repeated real root', 'No real roots'].filter((v) => v !== correct);
    const distractors = uniqueDistractors(
      correct,
      [...others, 'It depends on the coefficients'],
      [...others, 'Cannot be decided', 'Exactly three real roots'],
      rng
    );
    const reason =
      discriminant > 0
        ? 'greater than zero gives two distinct real roots — the curve crosses the x-axis twice'
        : discriminant === 0
          ? 'equal to zero gives one repeated root — the curve just touches the x-axis'
          : 'less than zero gives no real roots — the curve never reaches the x-axis';
    return {
      stem,
      correct,
      distractors,
      explanation: `The sign of $b^2 - 4ac$ decides this: ${reason}.`,
    };
  }

  if (mode === 'complete-square') {
    const stem = `Write $${quadratic(1, b, c, false)}$ in the form $(x + p)^2 + q$.`;
    const correct = `$${completedSquare(p, q)}$`;
    const candidates = [
      `$${completedSquare(-p, q)}$`,
      `$${completedSquare(p, -q)}$`,
      `$${completedSquare(b, q)}$`,
      `$${completedSquare(p, q + p)}$`,
    ];
    const fallback = [`$${completedSquare(p, q + 1)}$`, `$${completedSquare(p, q - 1)}$`, `$${completedSquare(-p, -q)}$`];
    const distractors = uniqueDistractors(correct, candidates, fallback, rng);
    const pSquared = p < 0 ? `(${p})^2` : `${p}^2`;
    const explanation = `Halve the coefficient of $x$: $\\dfrac{${b}}{2} = ${p}$. Then $${quadratic(1, b, c, false)} = ${completedSquare(p, q)}$, because $${pSquared} = ${p * p}$ and $${c} - ${p * p} = ${q}$.`;
    return { stem, correct, distractors, explanation };
  }

  const [low, high] = [r1, r2].sort((x, y) => x - y);
  const sum = low + high;
  const product = low * high;
  const stem = `Which equation has roots $${low}$ and $${high}$?`;
  const correct = `$${quadratic(1, -sum, product)}$`;
  const candidates = [
    `$${quadratic(1, sum, product)}$`,
    `$${quadratic(1, -sum, -product)}$`,
    `$${quadratic(1, sum, -product)}$`,
    `$${quadratic(1, product, sum)}$`,
  ];
  const fallback = [
    `$${quadratic(1, -sum, product + 1)}$`,
    `$${quadratic(1, -sum, product - 1)}$`,
    `$${quadratic(1, -(sum + 1), product)}$`,
  ];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);
  const explanation = `The roots add to $${sum}$ and multiply to $${product}$, so the equation is $x^2 - (${sum})x + (${product}) = 0$, that is $${quadratic(1, -sum, product)}$.`;
  return { stem, correct, distractors, explanation };
}

export const mathQuadratic: QuestionGenerator<QuadraticParams> = {
  id: 'math-quadratic',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
