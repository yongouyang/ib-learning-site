import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, pickDistinct, uniqueNumericDistractors } from './utils';

// Whole-number arithmetic and the order of operations: the value of a digit, column
// addition and subtraction, short multiplication, exact division, and the three BIDMAS
// shapes (a + b×c, (a + b)×c − d and a + b^p×c). Every answer is an integer built from the
// printed numbers, and the division mode multiplies first so the quotient is exact — the
// params table never has to be trusted to divide cleanly.
//
// Distractors are the named errors: working left to right, ignoring the brackets,
// multiplying where the question adds, and reading a digit's face value instead of its
// place value.

const MODES = ['place-value', 'add', 'subtract', 'multiply', 'divide', 'bidmas', 'brackets', 'power'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Multi-digit numbers for the place-value, add and subtract modes. */
  addends: z.array(z.number().int().min(10).max(99999)).min(2),
  /** Two-digit factors for short multiplication. */
  factorsA: z.array(z.number().int().min(11).max(99)).min(1),
  /** One-digit multipliers. */
  factorsB: z.array(z.number().int().min(2).max(9)).min(1),
  /** Divisors and quotients — the dividend is their product, so division is always exact. */
  divisors: z.array(z.number().int().min(2).max(25)).min(1),
  quotients: z.array(z.number().int().min(2).max(200)).min(1),
  /** [a, b, c] for a + b × c. */
  bidmas: z.array(z.tuple([z.number().int().min(1).max(30), z.number().int().min(2).max(12), z.number().int().min(2).max(12)])).min(1),
  /** [a, b, c, d] for (a + b) × c − d. */
  brackets: z
    .array(
      z.tuple([
        z.number().int().min(2).max(20),
        z.number().int().min(2).max(20),
        z.number().int().min(2).max(12),
        z.number().int().min(1).max(20),
      ])
    )
    .min(1),
  /** [a, b, p, c] for a + b^p × c. */
  powers: z
    .array(
      z.tuple([
        z.number().int().min(1).max(30),
        z.number().int().min(2).max(6),
        z.number().int().min(2).max(4),
        z.number().int().min(1).max(9),
      ])
    )
    .min(1),
});
export type IntegerOperationsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface IntegerValues {
  mode: Mode;
  /** First operand (the number whose digit is read, for place-value). */
  a: number;
  b: number;
  /** Third and fourth operands for the bracket and power modes. */
  c: number;
  d: number;
  /** The digit's place value for the place-value mode (0 elsewhere). */
  place: number;
  answer: string;
  answerValue: number;
}

const PLACES = [10000, 1000, 100, 10, 1];

const EMPTY: Omit<IntegerValues, 'mode' | 'answer' | 'answerValue'> = {
  a: 0,
  b: 0,
  c: 0,
  d: 0,
  place: 0,
};

export function draw(params: IntegerOperationsParams, rng: Rng): IntegerValues {
  const modes = params.modes ?? [...MODES];
  const addends = params.addends;
  const factorsA = params.factorsA;
  const factorsB = params.factorsB;
  const divisors = params.divisors;
  const quotients = params.quotients;
  const bidmas = params.bidmas;
  const brackets = params.brackets;
  const powers = params.powers;

  const feasible = modes.filter((mode) => {
    if (mode === 'place-value') return addends.some((n) => n >= 100);
    if (mode === 'add') return addends.length >= 2;
    if (mode === 'subtract') return addends.some((a) => addends.some((b) => a > b));
    if (mode === 'multiply') return factorsA.length > 0 && factorsB.length > 0;
    if (mode === 'divide') return divisors.length > 0 && quotients.length > 0;
    return true;
  });
  if (feasible.length === 0) {
    throw new Error('math-integer-operations: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const numeric = (a: number, b: number, c: number, d: number, value: number): IntegerValues => ({
    ...EMPTY,
    mode,
    a,
    b,
    c,
    d,
    answer: `$${fmtNumber(value)}$`,
    answerValue: value,
  });

  if (mode === 'place-value') {
    const n = pick(addends.filter((v) => v >= 100), rng);
    const places = PLACES.filter((p) => p <= n && Math.floor(n / p) % 10 !== 0);
    const place = pick(places, rng);
    const digit = Math.floor(n / place) % 10;
    return { ...numeric(n, 0, 0, 0, digit * place), mode, a: n, place };
  }

  if (mode === 'add') {
    const [a, b] = pickDistinct(addends, 2, rng);
    return numeric(a, b, 0, 0, a + b);
  }

  if (mode === 'subtract') {
    const [a, b] = pickDistinct(addends, 2, rng).sort((x, y) => y - x);
    return numeric(a, b, 0, 0, a - b);
  }

  if (mode === 'multiply') {
    const a = pick(factorsA, rng);
    const b = pick(factorsB, rng);
    return numeric(a, b, 0, 0, a * b);
  }

  if (mode === 'divide') {
    const d = pick(divisors, rng);
    const q = pick(quotients, rng);
    return numeric(q * d, d, 0, 0, q);
  }

  if (mode === 'bidmas') {
    const [a, b, c] = pick(bidmas, rng);
    return numeric(a, b, c, 0, a + b * c);
  }

  if (mode === 'brackets') {
    const [a, b, c, d] = pick(brackets, rng);
    return numeric(a, b, c, d, (a + b) * c - d);
  }

  const [a, b, p, c] = pick(powers, rng);
  return numeric(a, b, c, p, a + b ** p * c);
}

export function build(values: IntegerValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, c, d, place, answer } = values;
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, candidates, rng).map((v) => `$${fmtNumber(v)}$`) as [
      string,
      string,
      string,
    ];

  if (mode === 'place-value') {
    const digit = Math.floor(a / place) % 10;
    const names: Record<number, string> = {
      10000: 'ten thousands',
      1000: 'thousands',
      100: 'hundreds',
      10: 'tens',
      1: 'ones',
    };
    return {
      stem: `What is the value of the digit $${fmtNumber(digit)}$ in the number $${fmtNumber(a)}$?`,
      correct: answer,
      distractors: numeric([digit, digit * place * 10, digit * (place === 1 ? 100 : place / 10), a % 1000]),
      explanation: `The digit $${fmtNumber(digit)}$ sits in the ${names[place]} column, so it is worth $${fmtNumber(digit)} \\times ${fmtNumber(place)} = ${fmtNumber(digit * place)}$; $${fmtNumber(digit)}$ is its face value.`,
    };
  }

  if (mode === 'add') {
    return {
      stem: `Calculate $${fmtNumber(a)} + ${fmtNumber(b)}$.`,
      correct: answer,
      distractors: numeric([a - b, a + b + 100, a + b - 10, Math.abs(a - b) + 1]),
      explanation: `Add the columns from the right, carrying when a column reaches 10: $${fmtNumber(a)} + ${fmtNumber(b)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'subtract') {
    return {
      stem: `Calculate $${fmtNumber(a)} - ${fmtNumber(b)}$.`,
      correct: answer,
      distractors: numeric([a + b, b - a, a - b + 100, a - b - 10]),
      explanation: `Take the columns from the right, borrowing from the next column when needed: $${fmtNumber(a)} - ${fmtNumber(b)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'multiply') {
    return {
      stem: `Multiply $${fmtNumber(a)}$ by $${fmtNumber(b)}$.`,
      correct: answer,
      distractors: numeric([a * b + a, a * b - a, a * b + 10, a * (b + 1)]),
      explanation: `Split $${fmtNumber(a)}$ into tens and ones: $${fmtNumber(Math.floor(a / 10) * 10)} \\times ${fmtNumber(b)} = ${fmtNumber(Math.floor(a / 10) * 10 * b)}$ and $${fmtNumber(a % 10)} \\times ${fmtNumber(b)} = ${fmtNumber((a % 10) * b)}$, so together $${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'divide') {
    const q = values.answerValue;
    return {
      stem: `Calculate $${fmtNumber(a)} \\div ${fmtNumber(b)}$.`,
      correct: answer,
      distractors: numeric([q + 1, q - 1, q * 10, b * 2]),
      explanation: `Short division: $${fmtNumber(b)}$ goes into $${fmtNumber(a)}$ exactly $${fmtNumber(q)}$ times, because $${fmtNumber(b)} \\times ${fmtNumber(q)} = ${fmtNumber(a)}$.`,
    };
  }

  if (mode === 'bidmas') {
    return {
      stem: `Using BIDMAS, calculate $${fmtNumber(a)} + ${fmtNumber(b)} \\times ${fmtNumber(c)}$.`,
      correct: answer,
      distractors: numeric([(a + b) * c, a * b + c, a + b + c, a + b * c + c]),
      explanation: `Multiplication comes before addition, so work out $${fmtNumber(b)} \\times ${fmtNumber(c)} = ${fmtNumber(b * c)}$ first, then $${fmtNumber(a)} + ${fmtNumber(b * c)} = ${fmtNumber(values.answerValue)}$. The option $${fmtNumber((a + b) * c)}$ is the left-to-right answer.`,
    };
  }

  if (mode === 'brackets') {
    return {
      stem: `Calculate $(${fmtNumber(a)} + ${fmtNumber(b)}) \\times ${fmtNumber(c)} - ${fmtNumber(d)}$.`,
      correct: answer,
      distractors: numeric([a + b * c - d, (a + b) * (c - d), (a + b) * c + d, a * b * c - d]),
      explanation: `The bracket first: $${fmtNumber(a)} + ${fmtNumber(b)} = ${fmtNumber(a + b)}$. Then multiply: $${fmtNumber(a + b)} \\times ${fmtNumber(c)} = ${fmtNumber((a + b) * c)}$. Then subtract: $${fmtNumber((a + b) * c)} - ${fmtNumber(d)} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  return {
    stem: `Calculate $${fmtNumber(a)} + ${fmtNumber(b)}^{${fmtNumber(d)}} \\times ${fmtNumber(c)}$.`,
    correct: answer,
    distractors: numeric([(a + b) ** d * c, a + b * c, a + b ** (d + 1) * c, a + b ** d + c]),
    explanation: `Indices first: $${fmtNumber(b)}^{${fmtNumber(d)}} = ${fmtNumber(b ** d)}$. Then multiply: $${fmtNumber(b ** d)} \\times ${fmtNumber(c)} = ${fmtNumber(b ** d * c)}$. Then add: $${fmtNumber(a)} + ${fmtNumber(b ** d * c)} = ${fmtNumber(values.answerValue)}$.`,
  };
}

export const mathIntegerOperations: QuestionGenerator<IntegerOperationsParams> = {
  id: 'math-integer-operations',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
