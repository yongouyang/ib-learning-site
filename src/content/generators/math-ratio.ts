import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, gcd, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Ratio and proportion: simplifying a ratio, sharing an amount in a ratio, the unitary
// method, direct and inverse proportion, a map scale, a missing part, and the difference
// between two numbers in a ratio. Every multiple is constructed rather than solved for: the
// difference and the known part are computed FROM a chosen multiplier k, the amount is only
// shared when the ratio divides it exactly, and the proportion cases are filtered to those
// whose answer is a whole number — so no mode can print a fraction it did not intend.
//
// Distractors are the named errors: sharing in the wrong direction, dividing by the wrong
// part, using the unit price as the answer, and treating an inverse proportion as a direct
// one (multiplying where the question divides).

const MODES = [
  'simplify',
  'share',
  'unitary',
  'direct-proportion',
  'inverse-proportion',
  'map-scale',
  'missing-part',
  'difference',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Ratio pairs, used by every ratio mode. */
  ratios: z
    .array(z.tuple([z.number().int().min(2).max(99), z.number().int().min(2).max(99)]))
    .min(1),
  /** Totals to share in a ratio (only those the ratio divides exactly are drawn). */
  amounts: z.array(z.number().int().min(20).max(2000)).min(1),
  /** [count, totalCost] where the total is an exact multiple of the count. */
  unitCases: z.array(z.tuple([z.number().int().min(2).max(20), z.number().int().min(4).max(600)])).min(1),
  /** The quantity asked for in the unitary mode. */
  quantities: z.array(z.number().int().min(3).max(40)).min(1),
  /** [x1, y1, x2] for direct proportion y = kx (k must be exact). */
  directCases: z.array(z.tuple([z.number().int().min(2).max(40), z.number().int().min(2).max(400), z.number().int().min(2).max(40)])).min(1),
  /** [x1, y1, x2] for inverse proportion (the product must divide exactly). */
  inverseCases: z.array(z.tuple([z.number().int().min(2).max(40), z.number().int().min(2).max(400), z.number().int().min(2).max(40)])).min(1),
  /** Map scales as the "1 : n" denominator. */
  scales: z.array(z.number().int().min(1000).max(100000)).min(1),
  /** Map lengths in cm. */
  mapLengths: z.array(z.number().int().min(2).max(20)).min(1),
  /** The multiplier k that links a ratio's parts to the real counts. */
  factors: z.array(z.number().int().min(2).max(12)).min(1),
});
export type RatioParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface RatioValues {
  mode: Mode;
  /** The ratio parts. */
  a: number;
  b: number;
  /** The multiplier linking the ratio to the real counts. */
  k: number;
  /** The total shared, in pounds (0 where unused). */
  amount: number;
  count: number;
  totalCost: number;
  quantity: number;
  x1: number;
  y1: number;
  x2: number;
  scale: number;
  cm: number;
  answer: string;
  answerValue: number;
}

const EMPTY: Omit<RatioValues, 'mode' | 'answer' | 'answerValue'> = {
  a: 0,
  b: 0,
  k: 0,
  amount: 0,
  count: 0,
  totalCost: 0,
  quantity: 0,
  x1: 0,
  y1: 0,
  x2: 0,
  scale: 0,
  cm: 0,
};

export function draw(params: RatioParams, rng: Rng): RatioValues {
  const modes = params.modes ?? [...MODES];
  const ratios = params.ratios;
  const amounts = params.amounts;
  const unitCases = params.unitCases;
  const quantities = params.quantities;
  const directCases = params.directCases;
  const inverseCases = params.inverseCases;
  const scales = params.scales;
  const mapLengths = params.mapLengths;
  const factors = params.factors;

  const exact = (v: number): boolean => cleanNumbers([v]).length === 1;

  const feasible = modes.filter((mode) => {
    if (mode === 'simplify') return ratios.some(([a, b]) => gcd(a, b) > 1);
    if (mode === 'share') return ratios.some(([a, b]) => amounts.some((m) => m % (a + b) === 0));
    if (mode === 'unitary') {
      return unitCases.some(([c, t]) => t % c === 0) && quantities.length > 0;
    }
    if (mode === 'direct-proportion') return directCases.some(([x1, y1, x2]) => exact((y1 / x1) * x2));
    if (mode === 'inverse-proportion') return inverseCases.some(([x1, y1, x2]) => exact((x1 * y1) / x2));
    if (mode === 'map-scale') return scales.length > 0 && mapLengths.length > 0;
    return ratios.length > 0 && factors.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-ratio: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const numeric = (value: number, prefix = ''): RatioValues => ({
    ...EMPTY,
    mode,
    // House style: the number is a math span, the currency or unit stays prose — "£$78$".
    answer: `${prefix}$${fmtNumber(value)}$`,
    answerValue: value,
  });

  if (mode === 'simplify') {
    const [a, b] = pick(ratios.filter(([x, y]) => gcd(x, y) > 1), rng);
    const g = gcd(a, b);
    return { ...numeric(0), mode, a, b, answer: `$${fmtNumber(a / g)}:${fmtNumber(b / g)}$`, answerValue: NaN };
  }

  if (mode === 'share') {
    const [a, b] = pick(ratios.filter(([x, y]) => amounts.some((m) => m % (x + y) === 0)), rng);
    const amount = pick(amounts.filter((m) => m % (a + b) === 0), rng);
    const unit = amount / (a + b);
    const shareA = a * unit;
    const shareB = b * unit;
    return {
      ...numeric(0),
      mode,
      a,
      b,
      k: unit,
      amount,
      answer: `£$${fmtNumber(shareA)}$ and £$${fmtNumber(shareB)}$`,
      answerValue: NaN,
    };
  }

  if (mode === 'unitary') {
    const [count, totalCost] = pick(unitCases.filter(([c, t]) => t % c === 0), rng);
    const quantity = pick(quantities, rng);
    const unit = totalCost / count;
    return { ...numeric(unit * quantity, '£'), mode, count, totalCost, quantity, k: unit };
  }

  if (mode === 'direct-proportion') {
    const [x1, y1, x2] = pick(directCases.filter(([x1v, y1v, x2v]) => exact((y1v / x1v) * x2v)), rng);
    return { ...numeric((y1 / x1) * x2), mode, x1, y1, x2 };
  }

  if (mode === 'inverse-proportion') {
    const [x1, y1, x2] = pick(inverseCases.filter(([x1v, y1v, x2v]) => exact((x1v * y1v) / x2v)), rng);
    return { ...numeric((x1 * y1) / x2), mode, x1, y1, x2 };
  }

  if (mode === 'map-scale') {
    const scale = pick(scales, rng);
    const cm = pick(mapLengths, rng);
    // cm on the map × the scale denominator = real cm; ÷ 100 000 = km.
    return { ...numeric((cm * scale) / 100000), mode, scale, cm };
  }

  if (mode === 'missing-part') {
    const [a, b] = pick(ratios, rng);
    const k = pick(factors, rng);
    return { ...numeric(b * k), mode, a, b, k, amount: a * k, quantity: b };
  }

  const [a, b] = pick(ratios.filter(([x, y]) => x !== y), rng);
  const k = pick(factors, rng);
  const larger = Math.max(a, b) * k;
  const smaller = Math.min(a, b) * k;
  return { ...numeric(larger), mode, a, b, k, amount: larger - smaller };
}

export function build(values: RatioValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, k, amount, count, totalCost, quantity, x1, y1, x2, scale, cm, answer } = values;
  const value = values.answerValue;
  const numeric = (candidates: number[], prefix = ''): [string, string, string] =>
    uniqueNumericDistractors(value, cleanNumbers(candidates), rng).map(
      (v) => `${prefix}$${fmtNumber(v)}$`
    ) as [string, string, string];

  if (mode === 'simplify') {
    const g = gcd(a, b);
    const pool: string[] = [];
    for (let d = 2; d <= 12; d++) pool.push(`$${fmtNumber(a / d)}:${fmtNumber(b / d)}$`, `$${fmtNumber(b / d)}:${fmtNumber(a / d)}$`);
    return {
      stem: `Simplify $${fmtNumber(a)}:${fmtNumber(b)}$.`,
      correct: answer,
      distractors: uniqueDistractors(answer, [`$${fmtNumber(b / g)}:${fmtNumber(a / g)}$`, `$${fmtNumber(a / g)}:${fmtNumber(b / g + 1)}$`, `$${fmtNumber(a)}:${fmtNumber(b / g)}$`], pool, rng),
      explanation: `Both parts divide by $${fmtNumber(g)}$, the highest common factor: $${fmtNumber(a)} \\div ${fmtNumber(g)} = ${fmtNumber(a / g)}$ and $${fmtNumber(b)} \\div ${fmtNumber(g)} = ${fmtNumber(b / g)}$, giving ${answer}.`,
    };
  }

  if (mode === 'share') {
    const unit = amount / (a + b);
    const shareA = a * unit;
    const shareB = b * unit;
    const pool = [
      `£$${fmtNumber(amount / 2)}$ and £$${fmtNumber(amount / 2)}$`,
      `£$${fmtNumber(shareB)}$ and £$${fmtNumber(shareA)}$`,
      `£$${fmtNumber(a)}$ and £$${fmtNumber(b)}$`,
      `£$${fmtNumber(shareA + unit)}$ and £$${fmtNumber(shareB - unit)}$`,
    ];
    return {
      stem: `Divide £$${fmtNumber(amount)}$ in the ratio $${fmtNumber(a)}:${fmtNumber(b)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        pool,
        [
          `£$${fmtNumber(shareA)}$ and £$${fmtNumber(shareB + 2)}$`,
          `£$${fmtNumber(shareA - 2)}$ and £$${fmtNumber(shareB)}$`,
        ],
        rng
      ),
      explanation: `The ratio has $${fmtNumber(a)} + ${fmtNumber(b)} = ${fmtNumber(a + b)}$ parts, so one part is $£${fmtNumber(amount)} \\div ${fmtNumber(a + b)} = £${fmtNumber(unit)}$. That gives $${fmtNumber(a)} \\times £${fmtNumber(unit)} = £${fmtNumber(shareA)}$ and $${fmtNumber(b)} \\times £${fmtNumber(unit)} = £${fmtNumber(shareB)}$.`,
    };
  }

  if (mode === 'unitary') {
    const unit = totalCost / count;
    return {
      stem: `If $${fmtNumber(count)}$ items cost £$${fmtNumber(totalCost)}$, how much do $${fmtNumber(quantity)}$ items cost?`,
      correct: answer,
      distractors: numeric([totalCost, unit, unit * (quantity + 1), totalCost * quantity], '£'),
      explanation: `Find the cost of one item first: $£${fmtNumber(totalCost)} \\div ${fmtNumber(count)} = £${fmtNumber(unit)}$. Then multiply: $${fmtNumber(quantity)} \\times £${fmtNumber(unit)} = £${fmtNumber(value)}$. Using the original total $£${fmtNumber(totalCost)}$ without dividing is the common slip.`,
    };
  }

  if (mode === 'direct-proportion') {
    const constant = y1 / x1;
    return {
      stem: `$y$ is directly proportional to $x$. When $x = ${fmtNumber(x1)}$, $y = ${fmtNumber(y1)}$. Find $y$ when $x = ${fmtNumber(x2)}$.`,
      correct: answer,
      distractors: numeric([y1 * x2, y1 + x2, constant * (x2 + x1), y1 * (x2 / x1) * 2]),
      explanation: `Direct proportion means $y = kx$ with a constant $k$: $k = ${fmtNumber(y1)} \\div ${fmtNumber(x1)} = ${fmtNumber(constant)}$. Then $y = ${fmtNumber(constant)} \\times ${fmtNumber(x2)} = ${fmtNumber(value)}$. Multiplying the two given numbers ($ ${fmtNumber(y1 * x2)}$) is the usual error.`,
    };
  }

  if (mode === 'inverse-proportion') {
    const product = x1 * y1;
    return {
      stem: `$y$ is inversely proportional to $x$. When $x = ${fmtNumber(x1)}$, $y = ${fmtNumber(y1)}$. Find $y$ when $x = ${fmtNumber(x2)}$.`,
      correct: answer,
      distractors: numeric([product, (x1 / y1) * x2, product / x2 * 2, x2 * y1]),
      explanation: `Inverse proportion means $xy$ is constant: $${fmtNumber(x1)} \\times ${fmtNumber(y1)} = ${fmtNumber(product)}$. So $y = ${fmtNumber(product)} \\div ${fmtNumber(x2)} = ${fmtNumber(value)}$ — the answer gets ${x2 > x1 ? 'smaller' : 'larger'} as $x$ grows, not larger.`,
    };
  }

  if (mode === 'map-scale') {
    const correct = `${answer} km`;
    const kmCandidates = [
      `${fmtNumber((cm * scale) / 1000)} km`,
      `${fmtNumber((cm * scale) / 100)} km`,
      `${fmtNumber((cm * scale) / 10000)} km`,
      `${fmtNumber(cm * scale)} km`,
      `${fmtNumber((cm * scale) / 100000 + 1)} km`,
    ];
    return {
      stem: `A map has scale $1:${fmtNumber(scale)}$. A road is $${fmtNumber(cm)}$ cm long on the map. What is the real distance in km?`,
      correct,
      distractors: uniqueDistractors(correct, kmCandidates, ['$1$ km', '$10$ km', '$100$ km'], rng),
      explanation: `Each cm on the map is $${fmtNumber(scale)}$ cm in real life, so the road is $${fmtNumber(cm)} \\times ${fmtNumber(scale)} = ${fmtNumber(cm * scale)}$ cm. There are $100\\,000$ cm in a km, so that is $${fmtNumber(value)}$ km.`,
    };
  }

  if (mode === 'missing-part') {
    const known = a * k;
    return {
      stem: `The ratio of boys to girls in a club is $${fmtNumber(a)}:${fmtNumber(b)}$. If there are $${fmtNumber(known)}$ boys, how many girls are there?`,
      correct: answer,
      distractors: numeric([known, a * b, known + k, known / a]),
      explanation: `$${fmtNumber(known)} \\div ${fmtNumber(a)} = ${fmtNumber(k)}$ tells you one part of the ratio is $${fmtNumber(k)}$. The girls are $${fmtNumber(b)}$ parts, so $${fmtNumber(b)} \\times ${fmtNumber(k)} = ${fmtNumber(value)}$.`,
    };
  }

  const difference = amount;
  const larger = Math.max(a, b) * k;
  const smaller = Math.min(a, b) * k;
  return {
    stem: `Two numbers are in the ratio $${fmtNumber(a)}:${fmtNumber(b)}$ and their difference is $${fmtNumber(difference)}$. Find the larger number.`,
    correct: answer,
    distractors: numeric([smaller, difference, larger + difference, Math.max(a, b) * difference]),
    explanation: `The difference is $${fmtNumber(a)} - ${fmtNumber(b)} = ${fmtNumber(Math.abs(a - b))}$ parts, so one part is $${fmtNumber(difference)} \\div ${fmtNumber(
      Math.abs(a - b)
    )} = ${fmtNumber(k)}$. The larger number is $${fmtNumber(Math.max(a, b))} \\times ${fmtNumber(k)} = ${fmtNumber(larger)}$ (the smaller would be $${fmtNumber(smaller)}$).`,
  };
}

export const mathRatio: QuestionGenerator<RatioParams> = {
  id: 'math-ratio',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
