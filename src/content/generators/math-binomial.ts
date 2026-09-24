import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Binomial expansion: a binomial coefficient, the number of terms, the coefficient of a
// named power in three bracket shapes, Pascal's row, the constant term of (x + k/x)^n and
// the sum of all coefficients. Every value is an integer computed from the same table the
// question prints, so no answer depends on an approximation; n caps at 12 so the numbers
// stay readable in a 4-choice question.
//
// Distractors are the named errors: reading the term count as n, forgetting the power of
// the constant, using the neighbouring binomial coefficient, and using r! instead of
// nCr. The "estimate" mode is deliberately absent — a truncated binomial expansion can
// round to the true value at 4 d.p., which would put two defensible answers on screen.

const MODES = [
  'ncr',
  'term-count',
  'coefficient-x-plus-c',
  'coefficient-1-plus-kx',
  'coefficient-2x-plus-1',
  'pascal-row',
  'constant-term',
  'sum-of-coefficients',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** The power n. Kept small: 2^12 is already a four-digit coefficient. */
  ns: z.array(z.number().int().min(2).max(12)).min(1),
  /** Constants inside the bracket, for (x + c)^n. */
  cs: z.array(z.number().int().min(1).max(5)).min(1),
  /** Coefficient of x, for (1 + kx)^n and (kx + 1)^n. */
  ks: z.array(z.number().int().min(1).max(4)).min(1),
  /** Powers asked for in the coefficient modes. */
  rs: z.array(z.number().int().min(1).max(11)).min(1),
});
export type BinomialParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface BinomialValues {
  mode: Mode;
  n: number;
  /** The chosen power (0 where unused). */
  r: number;
  /** The constant inside the bracket, or the coefficient of x (0 where unused). */
  k: number;
  answer: string;
  answerValue: number;
}

/** nCr by the multiplicative formula — exact for the small n this generator allows. */
export function choose(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let out = 1;
  for (let i = 0; i < r; i++) out = (out * (n - i)) / (i + 1);
  return Math.round(out);
}

/** Row n of Pascal's triangle as "1, 4, 6, 4, 1". */
export function pascalRow(n: number): string {
  return Array.from({ length: n + 1 }, (_, r) => choose(n, r)).join(', ');
}

const EMPTY: Omit<BinomialValues, 'mode' | 'answer' | 'answerValue'> = { n: 0, r: 0, k: 0 };

export function draw(params: BinomialParams, rng: Rng): BinomialValues {
  const modes = params.modes ?? [...MODES];
  const ns = params.ns;
  const cs = params.cs;
  const ks = params.ks;
  const rs = params.rs;

  const feasible = modes.filter((mode) => {
    if (mode === 'constant-term') return ns.some((n) => n % 2 === 0);
    if (mode === 'coefficient-x-plus-c') return ns.some((n) => rs.some((r) => r >= 1 && r <= n - 1));
    if (mode === 'coefficient-1-plus-kx' || mode === 'coefficient-2x-plus-1') {
      return ns.some((n) => rs.some((r) => r >= 1 && r <= n));
    }
    return ns.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-binomial: no mode is feasible for this param table — add ns/cs/ks/rs');
  }
  const mode = pick(feasible, rng);
  const numeric = (n: number): BinomialValues => ({
    ...EMPTY,
    mode,
    n,
    answer: `$${fmtNumber(n)}$`,
    answerValue: n,
  });

  if (mode === 'ncr') {
    const n = pick(ns.filter((v) => v >= 2), rng);
    const r = 1 + Math.floor(rng() * (n - 1));
    return {
      ...numeric(choose(n, r)),
      mode,
      n,
      r,
      answer: `$${fmtNumber(choose(n, r))}$`,
      answerValue: choose(n, r),
    };
  }

  if (mode === 'term-count') {
    const n = pick(ns, rng);
    return { ...numeric(n + 1), mode, n, answer: `$${fmtNumber(n + 1)}$`, answerValue: n + 1 };
  }

  if (mode === 'coefficient-x-plus-c') {
    const n = pick(ns.filter((v) => rs.some((r) => r >= 1 && r <= v - 1)), rng);
    const c = pick(cs, rng);
    const r = pick(rs.filter((v) => v >= 1 && v <= n - 1), rng);
    // Coefficient of x^r in (x + c)^n is nCr · c^(n-r).
    const value = choose(n, r) * c ** (n - r);
    return { ...numeric(value), mode, n, r, k: c, answer: `$${fmtNumber(value)}$`, answerValue: value };
  }

  if (mode === 'coefficient-1-plus-kx') {
    const n = pick(ns.filter((v) => rs.some((r) => r >= 1 && r <= v)), rng);
    const k = pick(ks, rng);
    const r = pick(rs.filter((v) => v >= 1 && v <= n), rng);
    const value = choose(n, r) * k ** r;
    return { ...numeric(value), mode, n, r, k, answer: `$${fmtNumber(value)}$`, answerValue: value };
  }

  if (mode === 'coefficient-2x-plus-1') {
    const n = pick(ns.filter((v) => rs.some((r) => r >= 1 && r <= v)), rng);
    const r = pick(rs.filter((v) => v >= 1 && v <= n), rng);
    const value = choose(n, r) * 2 ** r;
    return { ...numeric(value), mode, n, r, answer: `$${fmtNumber(value)}$`, answerValue: value };
  }

  if (mode === 'pascal-row') {
    const n = pick(ns, rng);
    return { ...EMPTY, mode, n, answer: pascalRow(n), answerValue: NaN };
  }

  if (mode === 'constant-term') {
    const n = pick(ns.filter((v) => v % 2 === 0), rng);
    const k = pick(cs, rng);
    // (x + k/x)^(2t): the constant term is C(2t, t) k^t.
    const t = n / 2;
    const value = choose(n, t) * k ** t;
    return { ...numeric(value), mode, n, k, answer: `$${fmtNumber(value)}$`, answerValue: value };
  }

  const n = pick(ns, rng);
  const k = pick(ks, rng);
  // The sum of the coefficients of (kx + 1)^n is its value at x = 1.
  const value = (k + 1) ** n;
  return { ...numeric(value), mode, n, k, answer: `$${fmtNumber(value)}$`, answerValue: value };
}

export function build(values: BinomialValues, rng: Rng): GeneratorOutput {
  const { mode, n, r, k, answer } = values;
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, candidates, rng).map((v) => `$${fmtNumber(v)}$`) as [
      string,
      string,
      string,
    ];

  if (mode === 'ncr') {
    return {
      stem: `Evaluate $\\binom{${fmtNumber(n)}}{${fmtNumber(r)}}$.`,
      correct: answer,
      distractors: numeric([choose(n, r - 1), choose(n, r + 1), n * r, choose(n - 1, r)]),
      explanation: `$\\binom{${fmtNumber(n)}}{${fmtNumber(r)}} = \\dfrac{${fmtNumber(n)}!}{${fmtNumber(r)}!\\,${fmtNumber(n - r)}!} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'term-count') {
    return {
      stem: `How many terms are in the expansion of $(a + b)^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: numeric([n, 2 * n, n - 1, n + 2]),
      explanation: `The expansion runs from $a^n$ down to $b^n$ in unit steps, giving $${fmtNumber(n)} + 1 = ${fmtNumber(n + 1)}$ terms (the coefficient $${fmtNumber(n)}$ is the largest power, not the count).`,
    };
  }

  if (mode === 'coefficient-x-plus-c') {
    const value = values.answerValue;
    return {
      stem: `What is the coefficient of $x^{${fmtNumber(r)}}$ in the expansion of $(x + ${fmtNumber(k)})^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: numeric([
        choose(n, r),
        choose(n, r) * k ** (n - r - 1),
        choose(n, r + 1) * k ** (n - r - 1),
        n * k ** (n - r),
      ]),
      explanation: `The term in $x^{${fmtNumber(r)}}$ is $\\binom{${fmtNumber(n)}}{${fmtNumber(r)}} x^{${fmtNumber(r)}} \\cdot ${fmtNumber(k)}^{${fmtNumber(n - r)}} = ${fmtNumber(choose(n, r))} \\times ${fmtNumber(k ** (n - r))} = ${fmtNumber(value)}$.`,
    };
  }

  if (mode === 'coefficient-1-plus-kx') {
    const value = values.answerValue;
    return {
      stem: `What is the coefficient of $x^{${fmtNumber(r)}}$ in the expansion of $(1 + ${fmtNumber(k)}x)^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: numeric([choose(n, r), choose(n, r) * k ** (r + 1), n * k ** r, choose(n, r) * k ** (r - 1)]),
      explanation: `The term in $x^{${fmtNumber(r)}}$ is $\\binom{${fmtNumber(n)}}{${fmtNumber(r)}} (${fmtNumber(k)}x)^{${fmtNumber(r)}} = ${fmtNumber(choose(n, r))} \\times ${fmtNumber(k ** r)} = ${fmtNumber(value)}$.`,
    };
  }

  if (mode === 'coefficient-2x-plus-1') {
    const value = values.answerValue;
    return {
      stem: `What is the coefficient of $x^{${fmtNumber(r)}}$ in the expansion of $(2x + 1)^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: numeric([choose(n, r), choose(n, r) * 2 ** (r + 1), choose(n, r + 1) * 2 ** r, n * 2 ** r]),
      explanation: `The term in $x^{${fmtNumber(r)}}$ is $\\binom{${fmtNumber(n)}}{${fmtNumber(r)}} (2x)^{${fmtNumber(r)}} = ${fmtNumber(choose(n, r))} \\times ${fmtNumber(2 ** r)} = ${fmtNumber(value)}$.`,
    };
  }

  if (mode === 'pascal-row') {
    const wrong = [pascalRow(n - 1), pascalRow(n + 1), pascalRow(n + 2)];
    return {
      stem: `Which row of Pascal's triangle gives the coefficients of $(a + b)^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: uniqueDistractors(answer, wrong, [`$1, ${fmtNumber(n)}, 1$`, '$1, 1$'], rng),
      explanation: `Row $${fmtNumber(n + 1)}$ of Pascal's triangle (counting the top $1$ as row 1) reads $${answer}$; the row for the next power is $${pascalRow(n + 1)}$.`,
    };
  }

  if (mode === 'constant-term') {
    const t = n / 2;
    const value = values.answerValue;
    return {
      stem: `What is the constant term in the expansion of $\\left(x + \\dfrac{${fmtNumber(k)}}{x}\\right)^{${fmtNumber(n)}}$?`,
      correct: answer,
      distractors: numeric([choose(n, t), choose(n, t) * k ** (t + 1), choose(n, t) * k ** (t - 1), n * k ** t]),
      explanation: `The constant term comes from the term with $x^{${fmtNumber(t)}} \\cdot x^{-${fmtNumber(t)}}$, which is $\\binom{${fmtNumber(n)}}{${fmtNumber(t)}} ${fmtNumber(k)}^{${fmtNumber(t)}} = ${fmtNumber(choose(n, t))} \\times ${fmtNumber(k ** t)} = ${fmtNumber(value)}$.`,
    };
  }

  const value = values.answerValue;
  return {
    stem: `What is the sum of all the coefficients in the expansion of $(${fmtNumber(k)}x + 1)^{${fmtNumber(n)}}$?`,
    correct: answer,
    distractors: numeric([k ** n, (k + 1) ** (n - 1), 2 ** n, n * (k + 1)]),
    explanation: `Substituting $x = 1$ turns every term into its coefficient, so the sum is $(${fmtNumber(k)} + 1)^{${fmtNumber(n)}} = ${fmtNumber(value)}$. $${fmtNumber(k ** n)}$ would ignore the constant term.`,
  };
}

export const mathBinomial: QuestionGenerator<BinomialParams> = {
  id: 'math-binomial',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
