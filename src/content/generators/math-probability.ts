import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, gcd, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Probability: one event from a bag, the complement, "A or B" for disjoint events,
// the product of two independent events, two draws with and without replacement,
// and an expected count.
//
// Every instance is CONSTRUCTED so the answer is exact and in lowest terms: the bag
// is drawn as integer counts, the independent-events mode multiplies two fractions
// from a fixed exact table, and the expected-count mode only draws trial numbers the
// denominator divides.
//
// Distractors are the named errors: quoting the complement, adding where the rule
// multiplies, replacing when the question says without replacement (and vice versa),
// and halving one factor.

const MODES = ['single', 'complement', 'or', 'and-independent', 'with-replacement', 'without-replacement', 'expected'] as const;

/** Exact fractions the independent-events mode may draw (nothing here repeats). */
const EXACT: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [1, 6],
  [5, 6],
];

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Favourable counts (red counters in the bag, say). */
    counts: z.array(z.number().int().min(1)).min(1),
    /** Population sizes; a count must be strictly smaller for the mode to draw. */
    totals: z.array(z.number().int().min(2)).min(1),
    /** Trial counts for the expected-value mode. */
    trials: z.array(z.number().int().min(2)).min(1).default([40, 50, 60, 80, 100, 120]),
  })
  .refine((p) => p.counts.some((c) => p.totals.some((t) => c < t)), {
    message: 'math-probability: needs at least one count smaller than a total, or no bag mode can draw',
  });
export type ProbabilityParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface ProbabilityValues {
  mode: Mode;
  /** Favourable count (or first numerator). */
  r: number;
  /** Population size (or first denominator). */
  n: number;
  /** Second count / numerator (0 when unused). */
  s: number;
  /** Second denominator (0 when unused). */
  m: number;
  /** Trials (expected mode only). */
  t: number;
  /** The answer, in lowest terms (denominator 1 for the count modes). */
  answer: [number, number];
}

// Without the delimiters: explanations embed this inside their own `$...$` span,
// and a `$` pair interpolated inside another pair is the one thing the
// per-segment KaTeX check cannot see.
function latex(numerator: number, denominator: number): string {
  const g = gcd(Math.abs(numerator), Math.abs(denominator)) || 1;
  const p = numerator / g;
  const q = denominator / g;
  return q === 1 ? fmtNumber(p) : String.raw`\dfrac{${fmtNumber(p)}}{${fmtNumber(q)}}`;
}

function frac(numerator: number, denominator: number): string {
  return `$${latex(numerator, denominator)}$`;
}

const FALLBACK = EXACT.concat([
  [1, 8],
  [3, 8],
  [7, 10],
  [9, 10],
]).map(([p, q]) => frac(p, q));

function fractionChoices(
  answer: [number, number],
  candidates: [number, number][],
  rng: Rng
): [string, string, string] {
  // A candidate above 1 is not a probability at all — offering 4/3 would hand the
  // answer away to anyone who checks.
  const usable = candidates.filter(([p, q]) => p > 0 && q > 0 && p <= q);
  return uniqueDistractors(
    frac(answer[0], answer[1]),
    usable.map(([p, q]) => frac(p, q)),
    FALLBACK,
    rng
  );
}

const clean = (v: number) => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;

export function draw(params: ProbabilityParams, rng: Rng): ProbabilityValues {
  const modes = params.modes ?? [...MODES];
  const trials = params.trials ?? [40, 50, 60, 80, 100, 120];
  const bags: [number, number][] = [];
  for (const r of params.counts) for (const n of params.totals) if (r < n) bags.push([r, n]);

  const feasible = modes.filter((m) => {
    if (m === 'and-independent') return EXACT.length >= 2;
    if (m === 'expected') return EXACT.some(([, q]) => trials.some((t) => t % q === 0));
    if (m === 'or') return params.counts.some((r) => params.counts.some((s) => params.totals.some((n) => r + s < n)));
    if (m === 'with-replacement' || m === 'without-replacement') {
      return bags.some(([r]) => m === 'with-replacement' || r >= 2);
    }
    return bags.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-probability: no mode is feasible for this param table — add counts/totals/trials');
  }
  const mode = pick(feasible, rng);

  if (mode === 'and-independent') {
    const [first, ...rest] = EXACT;
    const a = pick(EXACT, rng);
    const others = rest.filter((f) => f[0] !== a[0] || f[1] !== a[1]);
    const b = pick(others.length > 0 ? others : [first], rng);
    return { mode, r: a[0], n: a[1], s: b[0], m: b[1], t: 0, answer: [a[0] * b[0], a[1] * b[1]] };
  }

  if (mode === 'expected') {
    const usable: [number, number, number][] = [];
    for (const [p, q] of EXACT) for (const t of trials) if (t % q === 0) usable.push([p, q, t]);
    const [p, q, t] = pick(usable, rng);
    return { mode, r: p, n: q, s: 0, m: 0, t, answer: [(t * p) / q, 1] };
  }

  if (mode === 'or') {
    const options: [number, number, number][] = [];
    for (const r of params.counts)
      for (const s of params.counts) for (const n of params.totals) if (r + s < n) options.push([r, s, n]);
    const [r, s, n] = pick(options, rng);
    return { mode, r, n, s, m: 0, t: 0, answer: [r + s, n] };
  }

  if (mode === 'with-replacement' || mode === 'without-replacement') {
    const usable = mode === 'with-replacement' ? bags : bags.filter(([r]) => r >= 2);
    const [r, n] = pick(usable, rng);
    const answer: [number, number] =
      mode === 'with-replacement' ? [r * r, n * n] : [r * (r - 1), n * (n - 1)];
    return { mode, r, n, s: 0, m: 0, t: 0, answer };
  }

  const [r, n] = pick(bags, rng);
  const answer: [number, number] = mode === 'complement' ? [n - r, n] : [r, n];
  return { mode, r, n, s: 0, m: 0, t: 0, answer };
}

export function build(values: ProbabilityValues, rng: Rng): GeneratorOutput {
  const { mode, r, n, s, m, t, answer } = values;
  const [p, q] = answer;

  if (mode === 'single') {
    const distractors = fractionChoices(answer, [[n - r, n], [r + 1, n], [r, n - 1]], rng);
    return {
      stem: `A bag contains ${fmtNumber(r)} red and ${fmtNumber(n - r)} blue counters. One counter is drawn at random. What is the probability it is red?`,
      correct: frac(p, q),
      distractors,
      explanation: `There are ${fmtNumber(r)} red counters out of ${fmtNumber(n)}, so $P(\\text{red}) = \\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} = ${latex(p, q)}$.`,
    };
  }

  if (mode === 'complement') {
    const distractors = fractionChoices(answer, [[r, n], [n - r, n - 1], [r, n - r]], rng);
    return {
      stem: `The probability that it rains tomorrow is ${frac(r, n)}. What is the probability that it does not rain?`,
      correct: frac(p, q),
      distractors,
      explanation: `$P(\\text{not }A) = 1 - P(A) = 1 - \\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} = ${latex(p, q)}$.`,
    };
  }

  if (mode === 'or') {
    const distractors = fractionChoices(answer, [[r, n], [s, n], [r + s, n - 1]], rng);
    return {
      stem: `A bag contains ${fmtNumber(r)} red, ${fmtNumber(s)} green and ${fmtNumber(n - r - s)} blue counters. One counter is drawn at random. What is the probability it is red or green?`,
      correct: frac(p, q),
      distractors,
      explanation: `Red and green cannot both happen, so the probabilities add: $\\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} + \\dfrac{${fmtNumber(s)}}{${fmtNumber(n)}} = ${latex(p, q)}$.`,
    };
  }

  if (mode === 'and-independent') {
    const distractors = fractionChoices(answer, [[r + s, n + m], [r * m, n * s], [r * s, n * n]], rng);
    return {
      stem: `A spinner lands on red with probability ${frac(r, n)} and a coin lands on heads with probability ${frac(s, m)}. What is the probability of red and heads?`,
      correct: frac(p, q),
      distractors,
      explanation: `Independent events multiply: $\\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} \\times \\dfrac{${fmtNumber(s)}}{${fmtNumber(m)}} = ${latex(p, q)}$.`,
    };
  }

  if (mode === 'with-replacement' || mode === 'without-replacement') {
    const without = mode === 'without-replacement';
    const second = without ? [r - 1, n - 1] : [r, n];
    const candidates: [number, number][] = without
      ? [[r * r, n * n], [r - 1, n - 1], [r * (r - 1), n * n]]
      : [[r * r, n * (n - 1)], [2 * r, n], [r * r, n]];
    const distractors = fractionChoices(answer, candidates, rng);
    return {
      stem: without
        ? `A bag contains ${fmtNumber(r)} red and ${fmtNumber(n - r)} blue counters. Two counters are drawn at random without replacement. What is the probability both are red?`
        : `A bag contains ${fmtNumber(r)} red and ${fmtNumber(n - r)} blue counters. A counter is drawn, replaced, then a second counter is drawn. What is the probability both are red?`,
      correct: frac(p, q),
      distractors,
      explanation: without
        ? `The first draw leaves ${fmtNumber(r - 1)} red of ${fmtNumber(n - 1)} counters, so $\\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} \\times \\dfrac{${fmtNumber(second[0])}}{${fmtNumber(second[1])}} = ${latex(p, q)}$.`
        : `Replacing restores the bag, so both draws are $\\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}}$ and $\\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} \\times \\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} = ${latex(p, q)}$.`,
    };
  }

  const count = cleanNumbers([t * (n - r) / n, t / n, t * r], 3).filter((v) => v > 0 && clean(v));
  const distractors = uniqueNumericDistractors(p, count, rng).map((v) => `$${fmtNumber(v)}$`) as [
    string,
    string,
    string,
  ];
  return {
    stem: `A spinner lands on red with probability ${frac(r, n)}. If it is spun ${fmtNumber(t)} times, how many times would you expect red?`,
    correct: `$${fmtNumber(p)}$`,
    distractors,
    explanation: `Expected number $=$ probability $\\times$ trials $= \\dfrac{${fmtNumber(r)}}{${fmtNumber(n)}} \\times ${fmtNumber(t)} = ${fmtNumber(p)}$.`,
  };
}

export const mathProbability: QuestionGenerator<ProbabilityParams> = {
  id: 'math-probability',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
