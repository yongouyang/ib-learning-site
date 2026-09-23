import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Calculus on polynomials: differentiate, the gradient at a point, integrate, a
// definite integral over [0, u], and the x-coordinate of a stationary point.
//
// Every instance is CONSTRUCTED, so no answer is a fraction or a decimal:
//  - the integrate modes print a coefficient of (n + 1)k, so dividing by n + 1 lands
//    on the integer k the question drew;
//  - the definite integral runs from 0 to u, so the lower limit contributes nothing;
//  - the stationary point comes from y = x² - 2px + q, whose turning point is exactly
//    x = p.
//
// NOT mechanized: the chain/product/quotient rules, trig, exponentials and
// optimisation word problems — those answers are not polynomial arithmetic.

const MODES = ['differentiate', 'gradient', 'integrate', 'definite', 'stationary'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Powers of the leading term (n >= 2, so the derivative is not a constant). */
  powers: z.array(z.number().int().min(2).max(5)).min(1).default([2, 3, 4]),
  /** Coefficient the answer lands on (k); the printed integrand uses (n + 1)k. */
  coefficients: z.array(z.number().int().min(1).max(6)).min(1).default([1, 2, 3, 4, 5]),
  /** x-coordinates for the gradient and stationary-point modes. */
  points: z.array(z.number().int().min(-4).max(4)).min(1).default([-3, -2, -1, 1, 2, 3]),
  /** Upper limits for the definite integral (0 is the lower limit). */
  limits: z.array(z.number().int().min(1).max(4)).min(1).default([1, 2, 3]),
});
export type CalculusParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface Term {
  coef: number;
  power: number;
}

export interface CalculusValues {
  mode: Mode;
  /** Leading power. */
  n: number;
  /** Coefficient the ANSWER lands on. */
  k: number;
  /** HALF the printed linear coefficient: the integrand prints 2b x so that
   *  integrating it lands on the integer b x^2 instead of a half. */
  b: number;
  /** Constant term (0 when the draw omits it). */
  c: number;
  /** x-coordinate for gradient / stationary-point, upper limit for definite. */
  x: number;
  answer: number;
}

export function poly(terms: Term[]): string {
  const live = terms.filter((t) => t.coef !== 0);
  if (live.length === 0) return '0';
  return live
    .map((t, i) => {
      const abs = Math.abs(t.coef);
      const body =
        t.power === 0 ? String(abs) : `${abs === 1 ? '' : String(abs)}x${t.power === 1 ? '' : `^{${t.power}}`}`;
      if (i === 0) return t.coef < 0 ? `-${body}` : body;
      return t.coef < 0 ? ` - ${body}` : ` + ${body}`;
    })
    .join('');
}

export function draw(params: CalculusParams, rng: Rng): CalculusValues {
  const modes = params.modes ?? [...MODES];
  const powers = params.powers ?? [2, 3, 4];
  const coefficients = params.coefficients ?? [1, 2, 3, 4, 5];
  const points = params.points ?? [-3, -2, -1, 1, 2, 3];
  const limits = params.limits ?? [1, 2, 3];

  const feasible = modes.filter((m) => {
    if (m === 'definite') return limits.length > 0;
    if (m === 'gradient' || m === 'stationary') return points.some((x) => x !== 0);
    return powers.length > 0 && coefficients.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-calculus: no mode is feasible for this param table — add powers/coefficients/points/limits');
  }
  const mode = pick(feasible, rng);

  const n = pick(powers, rng);
  const k = pick(coefficients, rng);
  const b = pick(coefficients, rng);

  if (mode === 'gradient') {
    const x = pick(points.filter((v) => v !== 0), rng);
    return { mode, n, k, b, c: 0, x, answer: k * n * x ** (n - 1) + b };
  }
  if (mode === 'definite') {
    const u = pick(limits, rng);
    return { mode, n, k, b, c: 0, x: u, answer: k * u ** (n + 1) + b * u ** 2 };
  }
  if (mode === 'stationary') {
    const p = pick(points.filter((v) => v !== 0), rng);
    return { mode, n: 2, k: 1, b: -2 * p, c: pick(coefficients, rng), x: p, answer: p };
  }
  // differentiate / integrate: a constant term is included on a coin flip.
  const c = rng() < 0.5 ? pick(coefficients, rng) : 0;
  return { mode, n, k, b, c, x: 0, answer: 0 };
}

function stringChoices(correct: string, candidates: string[], rng: Rng): [string, string, string] {
  return uniqueDistractors(correct, candidates, candidates, rng);
}

export function build(values: CalculusValues, rng: Rng): GeneratorOutput {
  const { mode, n, k, b, c, x, answer } = values;

  if (mode === 'differentiate') {
    // Printed curve: (k) x^n + b x + c — no scaling needed, the derivative is exact.
    const curve: Term[] = [
      { coef: k, power: n },
      { coef: b, power: 1 },
      { coef: c, power: 0 },
    ];
    const correct = `$${poly([{ coef: k * n, power: n - 1 }, { coef: b, power: 1 }])}$`;
    const candidates = [
      `$${poly([{ coef: k * n, power: n }, { coef: b, power: 1 }])}$`,
      `$${poly([{ coef: k, power: n - 1 }, { coef: b, power: 1 }])}$`,
      `$${poly([{ coef: k * n, power: n - 1 }])}$`,
      `$${poly([{ coef: k * n, power: n - 2 }, { coef: b, power: 1 }])}$`,
    ];
    if (c !== 0) {
      candidates.push(`$${poly([{ coef: k * n, power: n - 1 }, { coef: b, power: 1 }, { coef: c, power: 0 }])}$`);
    }
    const distractors = stringChoices(correct, candidates, rng);
    const note = distractors.includes(`$${poly([{ coef: k * n, power: n }, { coef: b, power: 1 }])}$`)
      ? ' The power must drop by one.'
      : '';
    return {
      stem: `Differentiate $y = ${poly(curve)}$.`,
      correct,
      distractors,
      explanation: `Multiply by the power and reduce it by one: $\\dfrac{dy}{dx} = ${poly([{ coef: k * n, power: n - 1 }, { coef: b, power: 1 }])}$.${note}`,
    };
  }

  if (mode === 'gradient') {
    const curve: Term[] = [
      { coef: k, power: n },
      { coef: b, power: 1 },
    ];
    const numeric = uniqueNumericDistractors(
      answer,
      [k * x ** n + b * x, k * n * x ** (n - 1), k * n * x ** n + b, k * n * x ** (n - 1) - b],
      rng
    ).map((v) => `$${fmtNumber(v)}$`) as [string, string, string];
    return {
      stem: `Find the gradient of the curve $y = ${poly(curve)}$ at the point where $x = ${fmtNumber(x)}$.`,
      correct: `$${fmtNumber(answer)}$`,
      distractors: numeric,
      explanation: `$\\dfrac{dy}{dx} = ${poly([{ coef: k * n, power: n - 1 }, { coef: b, power: 1 }])}$, and at $x = ${fmtNumber(x)}$ that is $${k * n} \\times ${fmtNumber(x)}^{${n - 1}} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${fmtNumber(answer)}$.`,
    };
  }

  if (mode === 'integrate') {
    // Printed integrand: (n + 1)k x^n + 2b x + c, so the integral lands back on the
    // integers k and b (a bare b x would integrate to a half).
    const integrand: Term[] = [
      { coef: (n + 1) * k, power: n },
      { coef: 2 * b, power: 1 },
      { coef: c, power: 0 },
    ];
    const antiderivative: Term[] = [
      { coef: k, power: n + 1 },
      { coef: b, power: 2 },
      { coef: c, power: 1 },
    ];
    const correct = `$${poly(antiderivative)} + C$`;
    const candidates = [
      `$${poly([{ coef: k, power: n + 2 }, { coef: b, power: 2 }, { coef: c, power: 1 }])} + C$`,
      `$${poly([{ coef: (n + 1) * k, power: n + 1 }, { coef: b, power: 2 }, { coef: c, power: 1 }])} + C$`,
      `$${poly([{ coef: k, power: n + 1 }, { coef: b, power: 1 }, { coef: c, power: 0 }])} + C$`,
      `$${poly(antiderivative)}$`,
      `$${poly([{ coef: k, power: n }, { coef: b, power: 2 }, { coef: c, power: 1 }])} + C$`,
    ];
    const distractors = stringChoices(correct, candidates, rng);
    return {
      stem: `Find $\\int (${poly(integrand)})\\, dx$.`,
      correct,
      distractors,
      explanation: `Raise each power by one and divide by the new power: $\\int ${poly(integrand)}\\, dx = ${poly(antiderivative)} + C$. The constant of integration is part of every indefinite integral.`,
    };
  }

  if (mode === 'definite') {
    const integrand: Term[] = [
      { coef: (n + 1) * k, power: n },
      { coef: 2 * b, power: 1 },
    ];
    const numeric = uniqueNumericDistractors(
      answer,
      [k * x ** (n + 1), (n + 1) * k * x ** (n + 1) + b * x ** 2, k * x ** n + b * x ** 2, k * x ** (n + 1) + b * x],
      rng
    ).map((v) => `$${fmtNumber(v)}$`) as [string, string, string];
    return {
      stem: `Evaluate $\\int_0^{${fmtNumber(x)}} (${poly(integrand)})\\, dx$.`,
      correct: `$${fmtNumber(answer)}$`,
      distractors: numeric,
      explanation: `The antiderivative is $${poly([{ coef: k, power: n + 1 }, { coef: b, power: 2 }])}$; substituting ${fmtNumber(x)} gives $${fmtNumber(k * x ** (n + 1))} + ${fmtNumber(b * x ** 2)} = ${fmtNumber(answer)}$, and substituting 0 gives 0.`,
    };
  }

  const curve: Term[] = [
    { coef: 1, power: 2 },
    { coef: b, power: 1 },
    { coef: c, power: 0 },
  ];
  const numeric = uniqueNumericDistractors(answer, [-answer, 2 * answer, answer + 1, answer - 1], rng).map(
    (v) => `$x = ${fmtNumber(v)}$`
  ) as [string, string, string];
  return {
    stem: `Find the $x$-coordinate of the stationary point of $y = ${poly(curve)}$.`,
    correct: `$x = ${fmtNumber(answer)}$`,
    distractors: numeric,
    explanation: `$\\dfrac{dy}{dx} = ${poly([{ coef: 2, power: 1 }, { coef: b, power: 0 }])}$, and a stationary point is where that is 0, so $x = ${fmtNumber(answer)}$.`,
  };
}

export const mathCalculus: QuestionGenerator<CalculusParams> = {
  id: 'math-calculus',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
