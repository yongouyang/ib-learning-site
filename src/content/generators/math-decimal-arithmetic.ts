import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, pickDistinct, uniqueNumericDistractors } from './utils';

// Decimal arithmetic: column addition and subtraction, multiplying a decimal by a power of
// ten, dividing a whole number by a power of ten, a decimal product, a decimal quotient, a
// fraction that terminates, and change from a £10 note. The params table holds the values
// as scaled integers (246 means 2.46), so every answer is exact by construction — the
// quotient and fraction modes only draw pairs whose decimal terminates, and the draw
// rejects a subtraction that would go negative at validation time rather than printing it.
//
// Distractors are the named errors: adding with the decimal points misaligned, losing or
// gaining a power of ten, multiplying where the question adds, and reversing the
// subtraction.

const MODES = [
  'add',
  'subtract',
  'multiply-decimal-by-power',
  'divide-integer-by-power',
  'product',
  'quotient',
  'fraction-to-decimal',
  'money-change',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Values in hundredths: 246 is 2.46. */
  hundredths: z.array(z.number().int().min(1).max(9999)).min(2),
  /** Values in thousandths: 58 is 0.058, and 34 stands for the whole number 34. */
  thousandths: z.array(z.number().int().min(1).max(9999)).min(1),
  /** Powers of ten to multiply or divide by. */
  powers: z.array(z.number().int().min(10).max(10000)).min(1),
  /** [tenths, hundredths] meaning a/10 × b/100 — 0.6 × 0.15 is [6, 15]. */
  products: z.array(z.tuple([z.number().int().min(1).max(9), z.number().int().min(1).max(99)])).min(1),
  /** [dividendHundredths, divisorTenths] meaning ah/100 ÷ d/10 — 5.6 ÷ 0.7 is [560, 7]. */
  quotients: z.array(z.tuple([z.number().int().min(1).max(9999), z.number().int().min(1).max(9)])).min(1),
  /** [numerator, denominator] whose decimal terminates: [7, 20] is 0.35. */
  fractions: z.array(z.tuple([z.number().int().min(1).max(99), z.number().int().min(2).max(100)])).min(1),
});
export type DecimalArithmeticParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface DecimalValues {
  mode: Mode;
  /** Scaled integers as they came from the params table (a is in hundredths for add/subtract). */
  a: number;
  b: number;
  /** The power of ten used by the two power modes (0 where unused). */
  p: number;
  answer: string;
  answerValue: number;
}

/** hundredths -> "2.46" (never float noise). */
const dec2 = (hundredths: number): string => fmtNumber(hundredths / 100);
/** thousandths -> "0.058". */
const dec3 = (thousandths: number): string => fmtNumber(thousandths / 1000);

const EMPTY: Omit<DecimalValues, 'mode' | 'answer' | 'answerValue'> = { a: 0, b: 0, p: 0 };

export function draw(params: DecimalArithmeticParams, rng: Rng): DecimalValues {
  const modes = params.modes ?? [...MODES];
  const hundredths = params.hundredths;
  const thousandths = params.thousandths;
  const powers = params.powers;
  const products = params.products;
  const quotients = params.quotients;
  const fractions = params.fractions;

  const exact = (v: number): boolean => cleanNumbers([v]).length === 1;

  const feasible = modes.filter((mode) => {
    if (mode === 'add') return hundredths.length >= 2;
    if (mode === 'subtract') return hundredths.some((a) => hundredths.some((b) => a > b));
    if (mode === 'product') return products.length > 0;
    if (mode === 'quotient') {
      return quotients.some(([a, b]) => b !== 0 && exact(a / (10 * b)));
    }
    if (mode === 'fraction-to-decimal') return fractions.some(([n, d]) => exact(n / d));
    if (mode === 'money-change') {
      return hundredths.some((a) => hundredths.some((b) => a + b < 1000));
    }
    return thousandths.length > 0 && powers.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-decimal-arithmetic: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const values = (a: number, b: number, p: number, value: number, prefix = ''): DecimalValues => ({
    ...EMPTY,
    mode,
    a,
    b,
    p,
    answer: `${prefix}${fmtNumber(value)}`,
    answerValue: value,
  });

  if (mode === 'add') {
    const [a, b] = pickDistinct(hundredths, 2, rng);
    return values(a, b, 0, (a + b) / 100);
  }

  if (mode === 'subtract') {
    const [a, b] = pickDistinct(hundredths, 2, rng).sort((x, y) => y - x);
    return values(a, b, 0, (a - b) / 100);
  }

  if (mode === 'multiply-decimal-by-power') {
    const t = pick(thousandths, rng);
    const p = pick(powers, rng);
    return values(t, 0, p, (t * p) / 1000);
  }

  if (mode === 'divide-integer-by-power') {
    const t = pick(thousandths, rng);
    const p = pick(powers, rng);
    return values(t, 0, p, t / p);
  }

  if (mode === 'product') {
    const [a, b] = pick(products, rng);
    return values(a, b, 0, (a * b) / 1000);
  }

  if (mode === 'quotient') {
    const usable = quotients.filter(([a, b]) => exact(a / (10 * b)));
    const [a, b] = pick(usable, rng);
    return values(a, b, 0, a / (10 * b));
  }

  if (mode === 'fraction-to-decimal') {
    const usable = fractions.filter(([n, d]) => exact(n / d));
    const [n, d] = pick(usable, rng);
    return { ...values(n, d, 0, n / d), mode, a: n, b: d };
  }

  const pairs: [number, number][] = [];
  for (const a of hundredths) for (const b of hundredths) if (a + b < 1000) pairs.push([a, b]);
  const [a, b] = pick(pairs, rng);
  return values(a, b, 0, 10 - (a + b) / 100, '£');
}

export function build(values: DecimalValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, p, answer } = values;
  const numeric = (candidates: number[], prefix = ''): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, cleanNumbers(candidates), rng).map(
      (v) => `${prefix}${fmtNumber(v)}`
    ) as [string, string, string];

  if (mode === 'add') {
    return {
      stem: `Calculate $${dec2(a)} + ${dec2(b)}$.`,
      correct: answer,
      distractors: numeric([(a + b) / 1000, (a + b) / 10, (a * b) / 100, Math.abs(a - b) / 100]),
      explanation: `Line up the decimal points and add column by column: $${dec2(a)} + ${dec2(b)} = ${fmtNumber(values.answerValue)}$. Adding $${dec2(b)}$ with its point one place over would give $${fmtNumber(a / 100 + b / 1000)}$.`,
    };
  }

  if (mode === 'subtract') {
    return {
      stem: `Calculate $${dec2(a)} - ${dec2(b)}$.`,
      correct: answer,
      distractors: numeric([(a - b) / 10, (a + b) / 100, (b - a) / 100, (a - b) / 1000]),
      explanation: `The digits must be lined up on the decimal points, so $${dec2(b)}$ is ${dec2(b)} with an empty hundredths column: $${dec2(a)} - ${dec2(b)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'multiply-decimal-by-power') {
    return {
      stem: `What is $${dec3(a)} \\times ${fmtNumber(p)}$?`,
      correct: answer,
      distractors: numeric([(a * p) / 100, (a * p) / 10000, a / 1000 / p, a * p]),
      explanation: `Multiplying by ${fmtNumber(p)} moves the decimal point ${String(p).length - 1} place${String(p).length - 1 === 1 ? '' : 's'} to the right: $${dec3(a)} \\times ${fmtNumber(p)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'divide-integer-by-power') {
    return {
      stem: `What is $${fmtNumber(a)} \\div ${fmtNumber(p)}$?`,
      correct: answer,
      distractors: numeric([a * p, a / (p / 10), a / (p * 10), a]),
      explanation: `Dividing by ${fmtNumber(p)} moves every digit ${String(p).length - 1} place${String(p).length - 1 === 1 ? '' : 's'} to the right: $${fmtNumber(a)} \\div ${fmtNumber(p)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'product') {
    return {
      stem: `Calculate $${dec2(a * 10)} \\times ${dec3(b * 10)}$.`,
      correct: answer,
      distractors: numeric([(a * b) / 100, (a * b) / 10000, (a * b) / 100000, a / 10 + b / 100]),
      explanation: `Multiply the digits ($ ${fmtNumber(a)} \\times ${fmtNumber(b)} = ${fmtNumber(a * b)}$) and count the decimal places — one in ${dec2(a * 10)} and two in ${dec3(b * 10)} — so the product has three: $${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'quotient') {
    return {
      stem: `Calculate $${dec2(a)} \\div ${dec2(b * 10)}$.`,
      correct: answer,
      distractors: numeric([values.answerValue * 10, values.answerValue / 10, (a / 100) * (b / 10), a / (b * 10)]),
      explanation: `Multiplying both numbers by 10 keeps the answer the same: $${dec2(a)} \\div ${dec2(b * 10)} = ${fmtNumber(a)} \\div ${fmtNumber(b * 10)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'fraction-to-decimal') {
    return {
      stem: `Which decimal is equivalent to $\\dfrac{${fmtNumber(a)}}{${fmtNumber(b)}}$?`,
      correct: answer,
      distractors: numeric([b / a, a / b / 10, a / b + 0.1, (a + 1) / b]),
      explanation: `Divide the numerator by the denominator: $${fmtNumber(a)} \\div ${fmtNumber(b)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  return {
    stem: `A shopper buys two items costing $£${dec2(a)}$ and $£${dec2(b)}$ and pays with a £10 note. How much change should they receive?`,
    correct: answer,
    distractors: numeric(
      [(a + b) / 100, 10 + (a + b) / 100, 10 - (a + b) / 1000, (a + b) / 1000],
      '£'
    ),
    explanation: `The items cost $£${dec2(a)} + £${dec2(b)} = £${dec2(a + b)}$, so the change is $£10 - £${dec2(a + b)} = £${fmtNumber(values.answerValue)}$.`,
  };
}

export const mathDecimalArithmetic: QuestionGenerator<DecimalArithmeticParams> = {
  id: 'math-decimal-arithmetic',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
