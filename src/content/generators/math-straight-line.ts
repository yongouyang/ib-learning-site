import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, pickDistinct, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Straight-line graphs: the gradient between two points, the y-intercept and the
// x-intercept, the equation from a gradient and a point, parallel and perpendicular
// gradients, horizontal lines, a missing coordinate, a point test, and the two linear
// cost models. Answers are constructed rather than derived wherever it matters: the
// two-point mode builds its points FROM a gradient, the x-intercept mode only draws an
// intercept the gradient divides exactly, and the missing-coordinate mode moves back
// along a chosen gradient. Nothing here can print a fraction the params cannot express.
//
// Distractors are the named errors: swapping gradient and intercept, dropping a sign,
// using the reciprocal where the negative reciprocal is needed, and testing a point
// that is one unit off the line.

const MODES = [
  'gradient-from-two-points',
  'y-intercept',
  'equation-from-gradient-and-intercept',
  'x-intercept',
  'parallel-through-point',
  'perpendicular-gradient',
  'horizontal-line',
  'missing-coordinate',
  'point-on-line',
  'cost-model',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Non-zero integer gradients each mode may draw. */
  gradients: z.array(z.number().int().refine((v) => v !== 0, 'a gradient of 0 is a horizontal line')).min(1),
  /** Integer y-intercepts. */
  intercepts: z.array(z.number().int()).min(1),
  /** Positive x-coordinates for the two-point, missing-coordinate and point-test modes. */
  xs: z.array(z.number().int().min(1)).min(2),
  /** Hourly/daily rate for the cost models. */
  rates: z.array(z.number().int().min(1)).min(1).default([15, 20, 25, 30, 40]),
  /** Fixed fee for the cost models. */
  fees: z.array(z.number().int().min(1)).min(1).default([5, 10, 20, 30, 40]),
});
export type StraightLineParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface StraightLineValues {
  mode: Mode;
  /** The line y = mx + c the question is about (0 where unused). */
  m: number;
  c: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  rate: number;
  fee: number;
  /** The printed correct choice. */
  answer: string;
  /** The same answer as a number for the numeric modes (NaN where the answer is a form). */
  answerValue: number;
}

/** The line y = mx + c in house style, with the sign of c spelled out. */
export function line(m: number, c: number): string {
  const mPart = m === 1 ? 'x' : m === -1 ? '-x' : `${fmtNumber(m)}x`;
  if (c === 0) return `$y = ${mPart}$`;
  return `$y = ${mPart} ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))}$`;
}

/** -1/m as a printed gradient, avoiding a visible "1/1". */
export function negativeReciprocal(m: number): string {
  if (m === 1) return '$-1$';
  if (m === -1) return '$1$';
  return m < 0 ? `$\\dfrac{1}{${fmtNumber(-m)}}$` : `$-\\dfrac{1}{${fmtNumber(m)}}$`;
}

const EMPTY: Omit<StraightLineValues, 'mode' | 'answer' | 'answerValue'> = {
  m: 0,
  c: 0,
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
  rate: 0,
  fee: 0,
};

export function draw(params: StraightLineParams, rng: Rng): StraightLineValues {
  const modes = params.modes ?? [...MODES];
  const gradients = params.gradients;
  const intercepts = params.intercepts;
  const xs = params.xs ?? [1, 2, 3, 4, 6];
  const rates = params.rates ?? [15, 20, 25, 30, 40];
  const fees = params.fees ?? [5, 10, 20, 30, 40];

  // A mode is only drawn when this params table can express its answer exactly.
  const feasible = modes.filter((mode) => {
    if (mode === 'x-intercept') {
      return gradients.some((m) => intercepts.some((c) => c !== 0 && c % m === 0));
    }
    if (mode === 'perpendicular-gradient') return gradients.some((m) => Math.abs(m) >= 2);
    if (mode === 'cost-model') return rates.length > 0 && fees.length > 0;
    if (mode === 'gradient-from-two-points' || mode === 'missing-coordinate' || mode === 'point-on-line') {
      return xs.length >= 2;
    }
    return true;
  });
  if (feasible.length === 0) {
    throw new Error('math-straight-line: no mode is feasible for this param table — add gradients/intercepts/xs');
  }
  const mode = pick(feasible, rng);

  if (mode === 'gradient-from-two-points') {
    const [x1, x2] = pickDistinct(xs, 2, rng);
    const m = pick(gradients, rng);
    const c = pick(intercepts, rng);
    return { ...EMPTY, mode, m, c, x1, y1: m * x1 + c, x2, y2: m * x2 + c, answer: `$${fmtNumber(m)}$`, answerValue: m };
  }

  if (mode === 'y-intercept') {
    const m = pick(gradients, rng);
    const c = pick(intercepts, rng);
    return { ...EMPTY, mode, m, c, answer: `$${fmtNumber(c)}$`, answerValue: c };
  }

  if (mode === 'equation-from-gradient-and-intercept') {
    const m = pick(gradients, rng);
    const c = pick(intercepts, rng);
    return { ...EMPTY, mode, m, c, answer: line(m, c), answerValue: NaN };
  }

  if (mode === 'x-intercept') {
    const m = pick(gradients, rng);
    const cs = intercepts.filter((c) => c !== 0 && c % m === 0);
    const c = pick(cs, rng);
    const x = -c / m;
    return { ...EMPTY, mode, m, c, answer: `$${fmtNumber(x)}$`, answerValue: x };
  }

  if (mode === 'parallel-through-point') {
    const m = pick(gradients, rng);
    const c = pick(intercepts, rng);
    const others = intercepts.filter((v) => v !== c);
    const b = others.length > 0 ? pick(others, rng) : c + 1;
    const x1 = pick(xs, rng);
    const y1 = m * x1 + b;
    return { ...EMPTY, mode, m, c, x1, y1, answer: line(m, b), answerValue: NaN };
  }

  if (mode === 'perpendicular-gradient') {
    const m = pick(gradients.filter((v) => Math.abs(v) >= 2), rng);
    return { ...EMPTY, mode, m, answer: negativeReciprocal(m), answerValue: NaN };
  }

  if (mode === 'horizontal-line') {
    const x1 = pick(xs, rng);
    const y1 = pick(intercepts, rng);
    return { ...EMPTY, mode, x1, y1, answer: `$y = ${fmtNumber(y1)}$`, answerValue: NaN };
  }

  if (mode === 'missing-coordinate') {
    const [x1, x2] = pickDistinct(xs, 2, rng);
    const m = pick(gradients, rng);
    const y2 = pick(intercepts, rng);
    const a = y2 - m * (x2 - x1);
    return { ...EMPTY, mode, m, x1, y1: a, x2, y2, answer: `$${fmtNumber(a)}$`, answerValue: a };
  }

  if (mode === 'point-on-line') {
    const m = pick(gradients, rng);
    const c = pick(intercepts, rng);
    const x1 = pick(xs, rng);
    const y1 = m * x1 + c;
    return { ...EMPTY, mode, m, c, x1, y1, answer: `$(${fmtNumber(x1)}, ${fmtNumber(y1)})$`, answerValue: NaN };
  }

  const rate = pick(rates, rng);
  const fee = pick(fees, rng);
  return { ...EMPTY, mode, rate, fee, answer: `$C = ${fmtNumber(rate)}h + ${fmtNumber(fee)}$`, answerValue: NaN };
}

export function build(values: StraightLineValues, rng: Rng): GeneratorOutput {
  const { mode, m, c, x1, y1, x2, y2, rate, fee, answer } = values;
  // A pool of plausible-looking wrong LINES, so a form-answer mode can never run out of
  // distinct distractors when the params table is small (uniqueDistractors throws rather
  // than print a duplicate).
  const linePool = [
    line(1, c),
    line(-1, c),
    line(m, 1),
    line(m, -1),
    line(m, 0),
    line(c || 1, m),
    line(-m, -c),
    line(m + 1, c),
    line(m, c + 1),
    '$y = x$',
    '$y = 1$',
    '$x = 1$',
    '$y = 0$',
    '$x = 0$',
  ];
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, candidates, rng).map((v) => `$${fmtNumber(v)}$`) as [
      string,
      string,
      string,
    ];

  if (mode === 'gradient-from-two-points') {
    return {
      stem: `What is the gradient of the line through $(${fmtNumber(x1)}, ${fmtNumber(y1)})$ and $(${fmtNumber(x2)}, ${fmtNumber(y2)})$?`,
      correct: answer,
      distractors: numeric([(x2 - x1) / (y2 - y1), y2 - y1, x2 - x1, -m]),
      explanation: `Gradient $= \\dfrac{\\text{change in } y}{\\text{change in } x} = \\dfrac{${fmtNumber(y2)} - ${fmtNumber(y1)}}{${fmtNumber(x2)} - ${fmtNumber(x1)}} = ${fmtNumber(m)}$.`,
    };
  }

  if (mode === 'y-intercept') {
    return {
      stem: `What is the $y$-intercept of $y = ${fmtNumber(m)}x ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))}$?`,
      correct: answer,
      distractors: numeric([m, -c, c + m, 0]),
      explanation: `The $y$-intercept is the value of $y$ when $x = 0$, which is the constant term $${fmtNumber(c)}$ — not the gradient $${fmtNumber(m)}$.`,
    };
  }

  if (mode === 'equation-from-gradient-and-intercept') {
    const wrong = [line(c, m), line(m, -c), line(-m, c)];
    return {
      stem: `A line has gradient $${fmtNumber(m)}$ and $y$-intercept $${fmtNumber(c)}$. What is its equation?`,
      correct: answer,
      distractors: uniqueDistractors(answer, wrong, linePool, rng),
      explanation: `Substitute $m = ${fmtNumber(m)}$ and $c = ${fmtNumber(c)}$ into $y = mx + c$: ${answer}. The other options swap the gradient and the intercept or lose a sign.`,
    };
  }

  if (mode === 'x-intercept') {
    return {
      stem: `Find the $x$-intercept of $y = ${fmtNumber(m)}x ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))}$.`,
      correct: answer,
      distractors: numeric([-c, c / m, c, -m]),
      explanation: `Set $y = 0$: $${fmtNumber(m)}x ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))} = 0$, so $x = ${fmtNumber(-c)} \\div ${fmtNumber(m)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'parallel-through-point') {
    const wrong = [line(-m, y1 - -m * x1), line(m, y1 + m * x1), `$y = ${fmtNumber(m)}x + ${fmtNumber(y1)}$`];
    return {
      stem: `Find the equation of the line through $(${fmtNumber(x1)}, ${fmtNumber(y1)})$ that is parallel to ${line(m, c)}.`,
      correct: answer,
      distractors: uniqueDistractors(answer, wrong, linePool, rng),
      explanation: `Parallel lines share the gradient $${fmtNumber(m)}$. Substituting $(${fmtNumber(x1)}, ${fmtNumber(y1)})$ into $y = ${fmtNumber(m)}x + b$ gives $b = ${fmtNumber(y1 - m * x1)}$, so ${answer}.`,
    };
  }

  if (mode === 'perpendicular-gradient') {
    const wrong = [`$${fmtNumber(-m)}$`, `$${fmtNumber(m)}$`, negativeReciprocal(-m)];
    return {
      stem: `A line is perpendicular to $y = ${fmtNumber(m)}x ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))}$. What is its gradient?`,
      correct: answer,
      distractors: uniqueDistractors(answer, wrong, [`$${fmtNumber(1 / m)}$`, '$-1$', '$1$'], rng),
      explanation: `Perpendicular gradients multiply to $-1$, so the gradient is $-\\dfrac{1}{${fmtNumber(m)}}$. $${fmtNumber(m)}$ is parallel, and $${fmtNumber(-m)}$ only flips the sign.`,
    };
  }

  if (mode === 'horizontal-line') {
    const wrong = [`$y = ${fmtNumber(x1)}$`, `$x = ${fmtNumber(y1)}$`, `$x = ${fmtNumber(x1)}$`];
    return {
      stem: `What is the equation of the horizontal line through $(${fmtNumber(x1)}, ${fmtNumber(y1)})$?`,
      correct: answer,
      distractors: uniqueDistractors(answer, wrong, ['$y = 0$', '$x = 0$', '$y = 1$', '$x = 1$', `$y = ${fmtNumber(y1 + 1)}$`, `$y = ${fmtNumber(y1 - 1)}$`], rng),
      explanation: `Every point on a horizontal line has the same $y$-coordinate, so the line is $y = ${fmtNumber(y1)}$; $x = ${fmtNumber(y1)}$ would be a vertical line.`,
    };
  }

  if (mode === 'missing-coordinate') {
    return {
      stem: `The points $(${fmtNumber(x1)}, a)$ and $(${fmtNumber(x2)}, ${fmtNumber(y2)})$ lie on a line with gradient $${fmtNumber(m)}$. Find $a$.`,
      correct: answer,
      distractors: numeric([y2 + m * (x2 - x1), y2 - m * (x2 + x1), y2, m * (x2 - x1)]),
      explanation: `Gradient $= \\dfrac{${fmtNumber(y2)} - a}{${fmtNumber(x2)} - ${fmtNumber(x1)}} = ${fmtNumber(m)}$, so $a = ${fmtNumber(y2)} - ${fmtNumber(m)} \\times ${fmtNumber(x2 - x1)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'point-on-line') {
    const points = [
      `$(${fmtNumber(x1)}, ${fmtNumber(y1 + 1)})$`,
      `$(${fmtNumber(x1 + 1)}, ${fmtNumber(y1)})$`,
      `$(${fmtNumber(x1)}, ${fmtNumber(y1 - 1)})$`,
      `$(${fmtNumber(x1 + 2)}, ${fmtNumber(y1)})$`,
    ];
    return {
      stem: `Which point lies on the line ${line(m, c)}?`,
      correct: answer,
      distractors: uniqueDistractors(answer, points, ['$(0, 1)$', '$(1, 0)$', '$(2, 3)$'], rng),
      explanation: `Substitute $x = ${fmtNumber(x1)}$: $y = ${fmtNumber(m)} \\times ${fmtNumber(x1)} ${c < 0 ? '-' : '+'} ${fmtNumber(Math.abs(c))} = ${fmtNumber(y1)}$, so $(${fmtNumber(x1)}, ${fmtNumber(y1)})$ is on the line.`,
    };
  }

  const wrong = [
    `$C = ${fmtNumber(fee)}h + ${fmtNumber(rate)}$`,
    `$C = ${fmtNumber(rate + fee)}h$`,
    `$C = ${fmtNumber(rate)}(h + ${fmtNumber(fee)})$`,
  ];
  return {
    stem: `A hire company charges a fixed fee of $£${fmtNumber(fee)}$ plus $£${fmtNumber(rate)}$ per hour. Let $C$ be the total cost and $h$ the number of hours. Which equation gives $C$?`,
    correct: answer,
    distractors: uniqueDistractors(answer, wrong, [`$C = ${fmtNumber(rate)}h$`, `$C = ${fmtNumber(rate)} - ${fmtNumber(fee)}h$`], rng),
    explanation: `The fixed fee is paid once, so it is the constant, and the hourly rate multiplies $h$: ${answer}. Swapping them reads the fee as hourly; multiplying the whole bracket charges the fee every hour.`,
  };
}

export const mathStraightLine: QuestionGenerator<StraightLineParams> = {
  id: 'math-straight-line',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
