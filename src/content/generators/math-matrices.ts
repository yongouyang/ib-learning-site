import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Matrices: the order of a matrix and of a product, the order of a transpose, a 2×2
// determinant, the value that makes a matrix singular, the determinant of a scaled matrix,
// the inverse of a 2×2 (drawn only from unimodular matrices, so every entry of the inverse is
// an integer), and a one-step transition-matrix calculation. Every value is computed from the
// numbers the question prints; nothing is estimated, and the inverse mode filters at the draw
// rather than printing fractions.
//
// Distractors are the named errors: transposing the order of a product (p × m instead of
// m × p), computing ad + bc for a determinant, forgetting that det(kA) is kⁿ·det(A) and not
// k·det(A), swapping only one pair of signs in an inverse, and adding the columns of a
// transition matrix instead of weighting them.

const MODES = [
  'order',
  'product-order',
  'transpose-order',
  'determinant-2x2',
  'singular-value',
  'determinant-of-scaled',
  'inverse-2x2',
  'transition-step',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** [rows, columns] pairs for the order and transpose modes. */
  sizes: z
    .array(z.tuple([z.number().int().min(2).max(5), z.number().int().min(2).max(5)]))
    .min(1)
    .default([
      [2, 3],
      [3, 2],
      [4, 3],
      [3, 4],
      [2, 5],
    ]),
  /** [m, n, p] for the product-order mode: A is m×n and B is n×p. */
  products: z
    .array(
      z.tuple([z.number().int().min(2).max(5), z.number().int().min(2).max(5), z.number().int().min(2).max(5)])
    )
    .min(1)
    .default([
      [2, 3, 4],
      [3, 2, 5],
      [4, 3, 2],
    ]),
  /** 2×2 matrices, as [[a, b], [c, d]]. */
  matrices: z
    .array(
      z.tuple([
        z.tuple([z.number().int().min(-9).max(9), z.number().int().min(-9).max(9)]),
        z.tuple([z.number().int().min(-9).max(9), z.number().int().min(-9).max(9)]),
      ])
    )
    .min(1),
  /** [a, b, c] for a matrix [[a, b], [c, k]] — k is the value that makes its determinant zero. */
  singular: z
    .array(z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(9), z.number().int().min(1).max(9)]))
    .min(1),
  /** [det, size] pairs for the scaled-determinant mode. */
  scaledDets: z
    .array(z.tuple([z.number().int().min(1).max(12), z.number().int().min(2).max(3)]))
    .min(1)
    .default([
      [4, 2],
      [2, 3],
      [5, 2],
      [3, 3],
    ]),
  /** [scalar, det, size] triples: find det(kA) given det(A) for an n×n matrix. */
  scalars: z.array(z.number().int().min(2).max(4)).min(1).default([2, 3, 4]),
  /** [p, x, y] for the transition step: T = [[p, 1−p], [1−p, p]] acting on [x, y]. */
  transitions: z
    .array(
      z.tuple([z.number().min(0.1).max(0.9), z.number().int().min(10).max(500), z.number().int().min(10).max(500)])
    )
    .min(1)
    .default([
      [0.6, 50, 150],
      [0.7, 100, 200],
      [0.4, 120, 80],
      [0.8, 50, 100],
    ]),
});
export type MatricesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface MatrixValues {
  mode: Mode;
  /** The 2×2 matrix in play, as [a, b, c, d] (all zero where unused). */
  m: [number, number, number, number];
  /** Rows/columns for the order modes (0 where unused). */
  rows: number;
  cols: number;
  inner: number;
  /** The singular value k, the scalar, the size and the determinant where used. */
  k: number;
  scalar: number;
  size: number;
  determinant: number;
  /** Transition parameters. */
  p: number;
  x: number;
  y: number;
  answer: string;
  answerValue: number;
}

const EMPTY: Omit<MatrixValues, 'mode' | 'answer' | 'answerValue'> = {
  m: [0, 0, 0, 0],
  rows: 0,
  cols: 0,
  inner: 0,
  k: 0,
  scalar: 0,
  size: 0,
  determinant: 0,
  p: 0,
  x: 0,
  y: 0,
};

/** A 2×2 matrix in house LaTeX. Note the doubled backslash: `\\` is a LaTeX row break. */
export function mat2(a: number, b: number, c: number, d: number): string {
  return `$\\begin{pmatrix} ${fmtNumber(a)} & ${fmtNumber(b)} \\\\ ${fmtNumber(c)} & ${fmtNumber(d)} \\end{pmatrix}$`;
}

/** Strip the outer math delimiters so a formatted answer can be embedded inside a span.
 *  Named `bare`, not `inner`: `build` destructures a field called `inner` (the shared dimension
 *  of a matrix product), which would shadow a helper of that name. */
function bare(formatted: string): string {
  return formatted.replace(/^\$|\$$/g, '');
}

/** ad − bc. */
export function det2(a: number, b: number, c: number, d: number): number {
  return a * d - b * c;
}

export function draw(params: MatricesParams, rng: Rng): MatrixValues {
  const modes = params.modes ?? [...MODES];
  const sizes = params.sizes ?? [[2, 3]];
  const products = params.products ?? [[2, 3, 4]];
  const matrices = params.matrices;
  const singular = params.singular;
  const scaledDets = params.scaledDets ?? [[4, 2]];
  const scalars = params.scalars ?? [2];
  const transitions = params.transitions ?? [[0.6, 50, 150]];

  const feasible = modes.filter((mode) => {
    if (mode === 'order' || mode === 'transpose-order') return sizes.length > 0;
    if (mode === 'product-order') return products.length > 0;
    if (mode === 'determinant-2x2') return matrices.length > 0;
    if (mode === 'singular-value') return singular.some(([a, b, c]) => (b * c) % a === 0);
    if (mode === 'determinant-of-scaled') return scaledDets.length > 0 && scalars.length > 0;
    if (mode === 'inverse-2x2') {
      return matrices.some(([[a, b], [c, d]]) => Math.abs(det2(a, b, c, d)) === 1);
    }
    return transitions.some(([p, x, y]) => cleanNumbers([p * x, (1 - p) * y]).length === 2);
  });
  if (feasible.length === 0) {
    throw new Error('math-matrices: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'order') {
    const [rows, cols] = pick(sizes, rng);
    return {
      ...EMPTY,
      mode,
      rows,
      cols,
      answer: `$${fmtNumber(rows)} \\times ${fmtNumber(cols)}$`,
      answerValue: NaN,
    };
  }

  if (mode === 'product-order') {
    const [rows, inner, cols] = pick(products, rng);
    return {
      ...EMPTY,
      mode,
      rows,
      cols,
      inner,
      answer: `$${fmtNumber(rows)} \\times ${fmtNumber(cols)}$`,
      answerValue: NaN,
    };
  }

  if (mode === 'transpose-order') {
    const [rows, cols] = pick(sizes, rng);
    // The transpose swaps the order, so the answer is the swap of the drawn pair.
    return {
      ...EMPTY,
      mode,
      rows: cols,
      cols: rows,
      answer: `$${fmtNumber(cols)} \\times ${fmtNumber(rows)}$`,
      answerValue: NaN,
    };
  }

  if (mode === 'determinant-2x2') {
    const [[a, b], [c, d]] = pick(matrices, rng);
    const value = det2(a, b, c, d);
    return { ...EMPTY, mode, m: [a, b, c, d], determinant: value, answer: `$${fmtNumber(value)}$`, answerValue: value };
  }

  if (mode === 'singular-value') {
    const [a, b, c] = pick(singular.filter(([p, q, r]) => (q * r) % p === 0), rng);
    const k = (b * c) / a;
    return { ...EMPTY, mode, m: [a, b, c, k], k, answer: `$${fmtNumber(k)}$`, answerValue: k };
  }

  if (mode === 'determinant-of-scaled') {
    const [det, size] = pick(scaledDets, rng);
    const scalar = pick(scalars, rng);
    const value = scalar ** size * det;
    return {
      ...EMPTY,
      mode,
      determinant: det,
      size,
      scalar,
      answer: `$${fmtNumber(value)}$`,
      answerValue: value,
    };
  }

  if (mode === 'inverse-2x2') {
    const [[a, b], [c, d]] = pick(matrices.filter(([[w, x], [y, z]]) => Math.abs(det2(w, x, y, z)) === 1), rng);
    const determinant = det2(a, b, c, d);
    // det = ±1, so the inverse is [d, −b; −c, a] / det with integer entries.
    return {
      ...EMPTY,
      mode,
      m: [a, b, c, d],
      determinant,
      answer: mat2(d / determinant, -b / determinant, -c / determinant, a / determinant),
      answerValue: NaN,
    };
  }

  const [p, x, y] = pick(transitions.filter(([q, u, v]) => cleanNumbers([q * u, (1 - q) * v]).length === 2), rng);
  const value = p * x + (1 - p) * y;
  return { ...EMPTY, mode, p, x, y, answer: `$${fmtNumber(value)}$`, answerValue: value };
}

export function build(values: MatrixValues, rng: Rng): GeneratorOutput {
  const { mode, m, rows, cols, inner, k, scalar, size, determinant, p, x, y, answer } = values;
  const [a, b, c, d] = m;
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, cleanNumbers(candidates), rng).map(
      (v) => `$${fmtNumber(v)}$`
    ) as [string, string, string];
  /** The order modes all answer "$m \times n$" — a swap is the natural distractor. */
  const orderChoices = (correct: string, swap: string): [string, string, string] =>
    uniqueDistractors(correct, [swap, '$2 \\times 2$', '$3 \\times 3$'], ['$1 \\times 1$', '$4 \\times 4$'], rng);

  if (mode === 'order') {
    return {
      stem: `What is the order of a matrix with $${fmtNumber(rows)}$ rows and $${fmtNumber(cols)}$ columns?`,
      correct: answer,
      distractors: orderChoices(answer, `$${fmtNumber(cols)} \\times ${fmtNumber(rows)}$`),
      explanation: `The order of a matrix is always rows × columns, so $${fmtNumber(rows)}$ rows and $${fmtNumber(
        cols
      )}$ columns gives ${answer}. Writing it the other way round describes the transpose.`,
    };
  }

  if (mode === 'product-order') {
    return {
      stem: `Let $A$ be a $${fmtNumber(rows)} \\times ${fmtNumber(inner)}$ matrix and $B$ be a $${fmtNumber(
        inner
      )} \\times ${fmtNumber(cols)}$ matrix. What is the order of $AB$?`,
      correct: answer,
      distractors: orderChoices(answer, `$${fmtNumber(cols)} \\times ${fmtNumber(rows)}$`),
      explanation: `The inner dimensions (${fmtNumber(inner)} and ${fmtNumber(
        inner
      )}) must agree, and they cancel; the outer ones survive: $(${fmtNumber(rows)} \\times ${fmtNumber(
        inner
      )})(${fmtNumber(inner)} \\times ${fmtNumber(cols)}) = ${bare(answer)}$. A product the other way round would be $${fmtNumber(
        cols
      )} \\times ${fmtNumber(rows)}$, which is generally a different matrix.`,
    };
  }

  if (mode === 'transpose-order') {
    // The drawn rows/cols are already swapped in the values, so the stem shows the original.
    return {
      stem: `If $A$ is a $${fmtNumber(cols)} \\times ${fmtNumber(rows)}$ matrix, what is the order of $A^{T}$?`,
      correct: answer,
      distractors: orderChoices(answer, `$${fmtNumber(cols)} \\times ${fmtNumber(rows)}$`),
      explanation: `Transposing swaps rows and columns, so a $${fmtNumber(cols)} \\times ${fmtNumber(
        rows
      )}$ matrix becomes ${answer}.`,
    };
  }

  if (mode === 'determinant-2x2') {
    return {
      stem: `Find the determinant of ${mat2(a, b, c, d)}.`,
      correct: answer,
      distractors: numeric([a * d + b * c, b * c - a * d, a * c - b * d, a + d]),
      explanation: `For $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$ the determinant is $ad - bc = (${fmtNumber(
        a
      )})(${fmtNumber(d)}) - (${fmtNumber(b)})(${fmtNumber(c)}) = ${fmtNumber(determinant)}$. Adding instead of subtracting gives $${fmtNumber(
        a * d + b * c
      )}$.`,
    };
  }

  if (mode === 'singular-value') {
    return {
      stem: `For which value of $k$ is the matrix ${mat2(a, b, c, k)} singular?`,
      correct: answer,
      distractors: numeric([-k, k * a, b * c, k + 1]),
      explanation: `A matrix is singular when its determinant is zero: $(${fmtNumber(a)})(${fmtNumber(k)}) - (${fmtNumber(
        b
      )})(${fmtNumber(c)}) = 0$, so $k = \\dfrac{${fmtNumber(b * c)}}{${fmtNumber(a)}} = ${fmtNumber(
        k
      )}$. A singular matrix has no inverse.`,
    };
  }

  if (mode === 'determinant-of-scaled') {
    return {
      stem: `If $A$ is a $${fmtNumber(size)} \\times ${fmtNumber(size)}$ matrix with $\\det(A) = ${fmtNumber(
        determinant
      )}$, what is $\\det(${fmtNumber(scalar)}A)$?`,
      correct: answer,
      distractors: numeric([scalar * determinant, scalar ** (size - 1) * determinant, determinant ** size, determinant + scalar]),
      explanation: `Every one of the $${fmtNumber(size)}$ rows is multiplied by $${fmtNumber(
        scalar
      )}$, so the determinant gains a factor of $${fmtNumber(scalar)}^{${fmtNumber(size)}} = ${fmtNumber(
        scalar ** size
      )}$. That gives $${fmtNumber(scalar ** size)} \\times ${fmtNumber(determinant)} = ${fmtNumber(
        values.answerValue
      )}$. Multiplying by $${fmtNumber(scalar)}$ only would be the 1×1 case.`,
    };
  }

  if (mode === 'inverse-2x2') {
    const inverseOf = (na: number, nb: number, nc: number, nd: number): string => mat2(na, nb, nc, nd);
    void inverseOf;
    return {
      stem: `Find the inverse of ${mat2(a, b, c, d)}.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          mat2(a, c, b, d), // transposed
          mat2(d, b, c, a), // wrong signs on both off-diagonals
          mat2(d, -b, -c, a), // the same shape with the dividing determinant dropped
          mat2(-d, b, c, -a),
        ],
        ['$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$', '$\\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}$'],
        rng
      ),
      explanation: `For $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$ the inverse is $\\dfrac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$. Here $\\det = ${fmtNumber(
        determinant
      )}$, so the entries are ${answer}. Swapping $a$ and $d$ but keeping the signs, or transposing instead of inverting, are the two standard errors.`,
    };
  }

  return {
    stem: `A transition matrix $T = ${bare(mat2(p, 1 - p, 1 - p, p))}$ acts on the state $S_0 = \\begin{pmatrix} ${fmtNumber(
      x
    )} \\\\ ${fmtNumber(y)} \\end{pmatrix}$. What is the first component of $S_1 = T S_0$?`,
    correct: answer,
    distractors: numeric([1 - p * x + (1 - p) * y, p * y + (1 - p) * x, x + y, p * x - (1 - p) * y]),
    explanation: `Row 1 of $T$ weights the two entries of $S_0$: $${fmtNumber(p)} \\times ${fmtNumber(
      x
    )} + ${fmtNumber(1 - p)} \\times ${fmtNumber(y)} = ${fmtNumber(
      values.answerValue
    )}$. Adding the two starting values ($${fmtNumber(x + y)}$) would ignore the weights — a transition matrix keeps the total, it does not sum the parts.`,
  };
}

export const mathMatrices: QuestionGenerator<MatricesParams> = {
  id: 'math-matrices',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
