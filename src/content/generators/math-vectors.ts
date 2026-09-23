import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, gcd, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Vectors in component form: add, subtract, scale, magnitude (2-D and 3-D), the dot
// product, a midpoint, a unit vector, and the missing component that makes two vectors
// perpendicular.
//
// Every instance is CONSTRUCTED, so no answer needs a square-root sign or a decimal:
// the magnitude and unit-vector modes draw from Pythagorean triples (so the components
// divide by the magnitude), the midpoint only draws pairs whose component sums are
// even, and perp-k is found by SEARCHING the param table for a divisible combination
// rather than by dividing and hoping.
//
// NOT mechanized: angles between arbitrary vectors, lines in 3-D, and triangle areas —
// those answers are inverse cosines or surds.

const MODES = ['add', 'subtract', 'scale', 'magnitude', 'dot', 'midpoint', 'unit', 'perp-k'] as const;

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Component values; zero is excluded from the perp-k search but allowed elsewhere. */
    components: z.array(z.number().int().min(-9).max(9)).min(2).default([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]),
    /** Scalar multipliers for the scale mode. */
    scalars: z.array(z.number().int().min(2).max(6)).min(1).default([2, 3, 4, 5]),
    /** Pythagorean triples [a, b, c] for the magnitude and unit-vector modes. */
    triples: z
      .array(z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]))
      .min(1)
      .default([
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [6, 8, 10],
        [9, 12, 15],
        [12, 16, 20],
      ]),
    /** 3-D Pythagorean quadruples [x, y, z, magnitude]. */
    solids: z
      .array(
        z.tuple([
          z.number().int().positive(),
          z.number().int().positive(),
          z.number().int().positive(),
          z.number().int().positive(),
        ])
      )
      .min(1)
      .default([
        [1, 2, 2, 3],
        [2, 3, 6, 7],
        [3, 4, 12, 13],
        [1, 4, 8, 9],
        [2, 6, 9, 11],
        [4, 4, 2, 6],
      ]),
  })
  .refine((p) => p.triples.every(([a, b, c]) => a * a + b * b === c * c), {
    message: 'math-vectors: every 2-D triple must satisfy a² + b² = c²',
  })
  .refine((p) => p.solids.every(([x, y, z, m]) => x * x + y * y + z * z === m * m), {
    message: 'math-vectors: every 3-D quadruple must satisfy x² + y² + z² = m²',
  });
export type VectorsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface VectorsValues {
  mode: Mode;
  /** Components of the first vector (third is 0 in 2-D). */
  a: [number, number, number];
  /** Components of the second vector (perp-k uses only b[0]). */
  b: [number, number, number];
  /** Scalar multiplier (scale) or the missing component (perp-k). */
  k: number;
  /** Dimension actually drawn. */
  dim: 2 | 3;
  /** The numeric answer; for the vector-valued modes it is unused. */
  answer: number;
}

function colLatex(parts: (number | string)[]): string {
  const body = parts.map((v) => (typeof v === 'number' ? fmtNumber(v) : v)).join(' \\\\ ');
  return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
}

/** With delimiters, for standalone use (a choice, or a stem with no other math). */
function col(parts: (number | string)[]): string {
  return `$${colLatex(parts)}$`;
}

const slice = (v: [number, number, number], dim: 2 | 3): number[] => (dim === 2 ? [v[0], v[1]] : [...v]);

export function draw(params: VectorsParams, rng: Rng): VectorsValues {
  const modes = params.modes ?? [...MODES];
  const components = params.components ?? [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6];
  const scalars = params.scalars ?? [2, 3, 4, 5];
  const triples = params.triples ?? [[3, 4, 5]];
  const solids = params.solids ?? [[1, 2, 2, 3]];

  // perp-k: search for (ax, ay, bx) whose dot-product equation forces a whole k.
  const perpOptions: [number, number, number, number][] = [];
  for (const ax of components)
    for (const ay of components)
      for (const bx of components) {
        if (ay === 0 || ax === 0 || bx === 0) continue;
        const k = -(ax * bx) / ay;
        if (Number.isInteger(k) && k !== 0 && Math.abs(k) <= 12) perpOptions.push([ax, ay, bx, k]);
      }
  // midpoint: only pairs whose component sums are even halve to integers.
  const midpointOptions: [number, number][][] = [];
  for (const ax of components)
    for (const ay of components)
      for (const bx of components)
        for (const by of components) {
          // A symmetric pair (b = -a) puts the midpoint at the origin, where the
          // "forgot to halve" distractor IS the correct answer and the draw throws.
          const midX = ax + bx;
          const midY = ay + by;
          if (midX % 2 === 0 && midY % 2 === 0 && (midX !== 0 || midY !== 0) && (ax !== bx || ay !== by)) {
            midpointOptions.push([
              [ax, ay],
              [bx, by],
            ]);
          }
        }

  const feasible = modes.filter((m) => {
    if (m === 'perp-k') return perpOptions.length > 0;
    if (m === 'midpoint') return midpointOptions.length > 0;
    if (m === 'magnitude') return triples.length > 0 || solids.length > 0;
    if (m === 'unit') return triples.length > 0;
    if (m === 'scale') return scalars.length > 0 && components.length >= 2;
    return components.length >= 2;
  });
  if (feasible.length === 0) {
    throw new Error('math-vectors: no mode is feasible for this param table — add components/scalars/triples');
  }
  const mode = pick(feasible, rng);
  // Only the magnitude and dot-product modes go 3-D; the column arithmetic stays 2-D
  // because that is where the IGCSE/KS3 column-vector questions live.
  const dim: 2 | 3 = mode === 'magnitude' ? (rng() < 0.4 ? 3 : 2) : mode === 'dot' && rng() < 0.5 ? 3 : 2;

  if (mode === 'magnitude') {
    if (dim === 3) {
      const [x, y, z, m] = pick(solids, rng);
      return { mode, a: [x, y, z], b: [0, 0, 0], k: 0, dim, answer: m };
    }
    const [x, y, m] = pick(triples, rng);
    return { mode, a: [x, y, 0], b: [0, 0, 0], k: 0, dim: 2, answer: m };
  }

  if (mode === 'unit') {
    const [x, y, m] = pick(triples, rng);
    return { mode, a: [x, y, 0], b: [0, 0, 0], k: 0, dim: 2, answer: m };
  }

  if (mode === 'perp-k') {
    const [ax, ay, bx, k] = pick(perpOptions, rng);
    return { mode, a: [ax, ay, 0], b: [bx, 0, 0], k, dim: 2, answer: k };
  }

  if (mode === 'midpoint') {
    const [[ax, ay], [bx, by]] = pick(midpointOptions, rng);
    return { mode, a: [ax, ay, 0], b: [bx, by, 0], k: 0, dim: 2, answer: 0 };
  }

  if (mode === 'scale') {
    const a: [number, number, number] = [pick(components, rng), pick(components, rng), 0];
    return { mode, a, b: [0, 0, 0], k: pick(scalars, rng), dim: 2, answer: 0 };
  }

  const a: [number, number, number] = [pick(components, rng), pick(components, rng), 0];
  const b: [number, number, number] = [pick(components, rng), pick(components, rng), 0];
  if (dim === 3) {
    a[2] = pick(components, rng);
    b[2] = pick(components, rng);
  }
  if (mode === 'dot') {
    const total = a[0] * b[0] + a[1] * b[1] + (dim === 3 ? a[2] * b[2] : 0);
    return { mode, a, b, k: 0, dim, answer: total };
  }
  return { mode, a, b, k: 0, dim, answer: 0 };
}

function vectorChoices(correct: string, candidates: string[], rng: Rng): [string, string, string] {
  return uniqueDistractors(correct, candidates, candidates, rng);
}

export function build(values: VectorsValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, k, dim, answer } = values;
  const vecA = col(slice(a, dim));
  const vecB = col(slice(b, dim));
  // Same vectors WITHOUT delimiters, for stems that already open a math span of
  // their own — nesting a `$...$` inside another prints the matrix as plain text.
  const bareA = colLatex(slice(a, dim));
  const bareB = colLatex(slice(b, dim));

  if (mode === 'add') {
    const sum: [number, number, number] = [a[0] + b[0], a[1] + b[1], 0];
    const correct = col([sum[0], sum[1]]);
    const distractors = vectorChoices(
      correct,
      [col([a[0] - b[0], a[1] - b[1]]), col([b[0] - a[0], b[1] - a[1]]), col([sum[0] + 1, sum[1]]), col([sum[0], sum[1] + 1])],
      rng
    );
    return {
      stem: `Given $\\mathbf{a} = ${bareA}$ and $\\mathbf{b} = ${bareB}$, find $\\mathbf{a} + \\mathbf{b}$.`,
      correct,
      distractors,
      explanation: `Add component by component: ${correct}. The subtraction options are $\\mathbf{a} - \\mathbf{b}$ and $\\mathbf{b} - \\mathbf{a}$.`,
    };
  }

  if (mode === 'subtract') {
    const diff: [number, number, number] = [a[0] - b[0], a[1] - b[1], 0];
    const correct = col([diff[0], diff[1]]);
    const distractors = vectorChoices(
      correct,
      [col([a[0] + b[0], a[1] + b[1]]), col([b[0] - a[0], b[1] - a[1]]), col([diff[0] + 1, diff[1]]), col([diff[0], diff[1] + 1])],
      rng
    );
    return {
      stem: `Given $\\mathbf{a} = ${bareA}$ and $\\mathbf{b} = ${bareB}$, find $\\mathbf{a} - \\mathbf{b}$.`,
      correct,
      distractors,
      explanation: `Subtract component by component: ${correct}. Adding instead gives $\\mathbf{a} + \\mathbf{b}$, and the order matters.`,
    };
  }

  if (mode === 'scale') {
    const correct = col([a[0] * k, a[1] * k]);
    const distractors = vectorChoices(
      correct,
      [col([a[0] * k, a[1]]), col([a[0] + k, a[1] + k]), col([-a[0] * k, -a[1] * k]), col([a[0] * k, a[1] * k + 1])],
      rng
    );
    return {
      stem: `Given $\\mathbf{a} = ${bareA}$, find $${fmtNumber(k)}\\mathbf{a}$.`,
      correct,
      distractors,
      explanation: `Multiply every component by ${fmtNumber(k)}: ${correct}. A scalar scales all of them, not just the first.`,
    };
  }

  if (mode === 'magnitude') {
    const parts = slice(a, dim);
    const squares = parts.reduce((total, v) => total + v * v, 0);
    const added = parts.reduce((total, v) => total + Math.abs(v), 0);
    const distractors = uniqueNumericDistractors(answer, [added, squares, answer + 1, Math.max(answer - 1, 1)], rng).map(
      (v) => `$${fmtNumber(v)}$`
    ) as [string, string, string];
    return {
      stem: `Find the magnitude of ${vecA}.`,
      correct: `$${fmtNumber(answer)}$`,
      distractors,
      explanation: `$|\\mathbf{a}| = \\sqrt{${parts.map((v) => `${fmtNumber(v)}^2`).join(' + ')}} = \\sqrt{${fmtNumber(squares)}} = ${fmtNumber(answer)}$. Adding the components instead gives ${fmtNumber(added)}.`,
    };
  }

  if (mode === 'dot') {
    const parts = slice(a, dim);
    const others = slice(b, dim);
    const total = parts.reduce((t, v) => t + v, 0) + others.reduce((t, v) => t + v, 0);
    const distractors = uniqueNumericDistractors(
      answer,
      [total, parts[0] * others[0] - parts[1] * others[1], (parts[0] + others[0]) * (parts[1] + others[1])],
      rng
    ).map((v) => `$${fmtNumber(v)}$`) as [string, string, string];
    const factor = (v: number) => (v < 0 ? `(${fmtNumber(v)})` : fmtNumber(v));
    const pairs = parts.map((v, i) => `${factor(v)} \\times ${factor(others[i])}`).join(' + ');
    return {
      stem: `Given $\\mathbf{a} = ${bareA}$ and $\\mathbf{b} = ${bareB}$, find $\\mathbf{a} \\cdot \\mathbf{b}$.`,
      correct: `$${fmtNumber(answer)}$`,
      distractors,
      explanation: `Multiply matching components and add: $${pairs} = ${fmtNumber(answer)}$. The dot product is a scalar, not a vector.`,
    };
  }

  if (mode === 'midpoint') {
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const correct = col(mid);
    const distractors = vectorChoices(
      correct,
      [
        col([a[0] + b[0], a[1] + b[1]]),
        col([(b[0] - a[0]) / 2, (b[1] - a[1]) / 2]),
        col([mid[0], -mid[1]]),
        col([mid[0], mid[1] + 1]),
      ],
      rng
    );
    return {
      stem: `The points $A$ and $B$ have position vectors ${vecA} and ${vecB}. Find the position vector of the midpoint of $AB$.`,
      correct,
      distractors,
      explanation: `The midpoint is the average of the two position vectors: $\\dfrac{1}{2}(${bareA} + ${bareB}) = ${colLatex(mid)}$.`,
    };
  }

  if (mode === 'unit') {
    const [x, y, m] = [a[0], a[1], answer];
    const frac = (v: number): string => {
      const g = gcd(Math.abs(v), m) || 1;
      const p = v / g;
      const q = m / g;
      return q === 1 ? fmtNumber(p) : String.raw`\dfrac{${fmtNumber(p)}}{${fmtNumber(q)}}`;
    };
    const correct = col([frac(x), frac(y)]);
    const distractors = vectorChoices(
      correct,
      [col([x, y]), col([frac(y), frac(x)]), col([frac(-x), frac(-y)]), col([frac(x), frac(-y)])],
      rng
    );
    return {
      stem: `Find the unit vector in the direction of ${vecA}.`,
      correct,
      distractors,
      explanation: `Divide by the magnitude: $|\\mathbf{a}| = \\sqrt{${fmtNumber(x)}^2 + ${fmtNumber(y)}^2} = ${fmtNumber(m)}$, so the unit vector is $\\dfrac{1}{${fmtNumber(m)}}${bareA} = ${colLatex([frac(x), frac(y)])}$. The ${colLatex([x, y])} option has length ${fmtNumber(m)}, not 1.`,
    };
  }

  const distractors = uniqueNumericDistractors(answer, [-answer, answer + 1, -a[0] * b[0], answer - 1], rng).map(
    (v) => `$k = ${fmtNumber(v)}$`
  ) as [string, string, string];
  return {
    stem: `The vectors ${vecA} and $\\begin{pmatrix} ${fmtNumber(b[0])} \\\\ k \\end{pmatrix}$ are perpendicular. Find $k$.`,
    correct: `$k = ${fmtNumber(answer)}$`,
    distractors,
    explanation: `Perpendicular means the dot product is 0, so $${fmtNumber(a[0])} \\times ${fmtNumber(b[0])} + ${fmtNumber(a[1])}k = 0$ and $k = ${fmtNumber(answer)}$.`,
  };
}

export const mathVectors: QuestionGenerator<VectorsParams> = {
  id: 'math-vectors',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
