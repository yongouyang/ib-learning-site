import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, uniqueDistractors } from './utils';

// Quadratic graph features: the vertex (turning point), the axis of symmetry, the
// y-intercept, and the x-intercepts read as the roots of the equation. A separate
// generator from math-quadratic (which drills solving and the discriminant) so the
// topics already wired to math-quadratic keep their exact draws.
//
// Every instance is CONSTRUCTED, so the printed quadratic has exactly the features
// asked about:
//  - vertex/axis/y-intercept draw the vertex (h, k) first, then b = -2h and
//    c = h^2 + k, so completing the square lands back on (x - h)^2 + k exactly;
//  - roots draws two distinct integer roots first (the same roots-based
//    construction as math-quadratic), so the curve crosses at exactly those points.
//
// Distractors are the named errors: the sign-flipped x-coordinate from -b/2, the
// coordinates swapped, y = h instead of x = h for a vertical line, the constant
// term read as an x-intercept, and both roots' signs flipped together.

const MODES = ['vertex', 'axis', 'y-intercept', 'roots'] as const;

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Magnitudes for the vertex x-coordinate and for the roots. */
    roots: z.array(z.number().int().min(1).max(9)).min(2),
    /** Vertex y-coordinates (the k in (x - h)^2 + k). */
    ks: z.array(z.number().int().min(-12).max(12)).min(1),
    /** Whether h and the roots may be negative. */
    negatives: z.boolean().default(true),
  })
  .refine((p) => new Set(p.roots).size >= 2, {
    message: 'math-quadratic-graphs: roots needs at least two distinct magnitudes, or the two roots can coincide',
  });
export type QuadraticGraphsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface QuadraticGraphsValues {
  mode: Mode;
  /** Vertex coordinates. */
  h: number;
  k: number;
  /** Roots (roots mode), low < high. */
  r1: number;
  r2: number;
  /** Coefficients of y = x^2 + bx + c. */
  b: number;
  c: number;
}

/** `x^2 - 4x + 3` — inner text, no 1x coefficient, no + 0 constant. */
function polyText(b: number, c: number): string {
  const bx = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x`;
  const cc = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  return `x^2${bx}${cc}`;
}

/** `(x - 3)` / `(x + 2)` — one linear factor, inner text. */
function factorText(r: number): string {
  return r >= 0 ? `(x - ${r})` : `(x + ${Math.abs(r)})`;
}

/** `(x - h)^2 + k` — inner text. */
function completedText(h: number, k: number): string {
  const bracket = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2`;
  return k === 0 ? bracket : `${bracket} ${k > 0 ? '+' : '-'} ${Math.abs(k)}`;
}

export function draw(params: QuadraticGraphsParams, rng: Rng): QuadraticGraphsValues {
  const modes = params.modes ?? [...MODES];
  const negatives = params.negatives ?? true;

  const signedRoots: number[] = [];
  for (const r of params.roots) {
    signedRoots.push(r);
    if (negatives) signedRoots.push(-r);
  }
  const distinct = [...new Set(signedRoots)];

  const feasible = modes.filter((mode) => {
    if (mode === 'roots') return distinct.length >= 2;
    return params.roots.length > 0 && params.ks.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-quadratic-graphs: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  const hMag = pick(params.roots, rng);
  const h = negatives && rng() < 0.5 ? -hMag : hMag;
  const k = pick(params.ks, rng);

  if (mode === 'roots') {
    const first = pick(distinct, rng);
    const rest = distinct.filter((v) => v !== first);
    const second = pick(rest, rng);
    const [r1, r2] = [first, second].sort((x, y) => x - y);
    return { mode, h, k, r1, r2, b: -(r1 + r2), c: r1 * r2 };
  }

  return { mode, h, k, r1: 0, r2: 0, b: -2 * h, c: h * h + k };
}

export function build(values: QuadraticGraphsValues, rng: Rng): GeneratorOutput {
  const { mode, h, k, r1, r2, b, c } = values;
  const poly = polyText(b, c);

  if (mode === 'vertex') {
    const correct = `$(${h}, ${k})$`;
    const distractors = uniqueDistractors(
      correct,
      [`$(${-h}, ${k})$`, `$(${h}, ${-k})$`, `$(${k}, ${h})$`],
      [`$(${h + 1}, ${k})$`, `$(${h - 1}, ${k})$`, `$(${h}, ${k + 1})$`, `$(${h}, ${k - 1})$`],
      rng
    );
    return {
      stem: `What is the turning point of the graph of $y = ${poly}$?`,
      correct,
      distractors,
      explanation: `Complete the square: $${poly} = ${completedText(h, k)}$. The bracket is zero at $x = ${h}$, where $y = ${k}$, so the turning point is $(${h}, ${k})$. The sign flips when the bracket is undone — $(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2$ puts the vertex at $x = ${h}$, not $x = ${-h}$.`,
    };
  }

  if (mode === 'axis') {
    const correct = `$x = ${h}$`;
    const distractors = uniqueDistractors(
      correct,
      [`$x = ${-h}$`, `$y = ${h}$`, `$x = ${k}$`],
      [`$x = ${h + 1}$`, `$x = ${h - 1}$`, `$y = ${k}$`, '$x = 0$'],
      rng
    );
    return {
      stem: `What is the equation of the line of symmetry of the graph of $y = ${poly}$?`,
      correct,
      distractors,
      explanation: `The line of symmetry passes through the turning point, at $x = -\\dfrac{b}{2} = -\\dfrac{(${b})}{2} = ${h}$. It is a vertical line, so its equation starts $x = $, not $y = $.`,
    };
  }

  if (mode === 'y-intercept') {
    const correct = `$(0, ${c})$`;
    const distractors = uniqueDistractors(
      correct,
      [`$(${c}, 0)$`, `$(0, ${b})$`, '$(0, 0)$'],
      [`$(0, ${c + 1})$`, `$(0, ${c - 1})$`, `$(1, ${c})$`],
      rng
    );
    return {
      stem: `Where does the graph of $y = ${poly}$ cross the $y$-axis?`,
      correct,
      distractors,
      explanation: `On the $y$-axis every point has $x = 0$, and setting $x = 0$ leaves only the constant term: $y = ${c}$. So the graph crosses at $(0, ${c})$ — the constant term read straight off the equation.`,
    };
  }

  const correct = `$x = ${r1}$ or $x = ${r2}$`;
  const distractors = uniqueDistractors(
    correct,
    [
      `$x = ${-r1}$ or $x = ${-r2}$`,
      `$x = ${-r1}$ or $x = ${r2}$`,
      `$x = ${r1}$`,
    ],
    [`$x = ${r1}$ or $x = ${-r2}$`, `$x = ${r2}$`, `$x = ${r1}$ or $x = ${r2 + 1}$`],
    rng
  );
  return {
    stem: `The graph of $y = ${poly}$ crosses the $x$-axis at two points. What are the solutions of $${poly} = 0$?`,
    correct,
    distractors,
    explanation: `The graph crosses the $x$-axis where $y = 0$. Factorising, $${poly} = ${factorText(r1)}${factorText(r2)}$, which is zero when a bracket is zero: $x = ${r1}$ or $x = ${r2}$. Each factor flips the sign of its root.`,
  };
}

export const mathQuadraticGraphs: QuestionGenerator<QuadraticGraphsParams> = {
  id: 'math-quadratic-graphs',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
