import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Directed numbers: adding, subtracting, multiplying and dividing with negatives, the mixed
// sign rule inside a BIDMAS expression, and the two context questions (a temperature rise and
// a dive below sea level). Every sign is decided at the draw, so the printed expression and
// the computed answer can never disagree; the division mode multiplies first so the answer is
// always a whole number.
//
// Distractors are the named errors: dropping a minus sign, treating two negatives in a
// product as negative, adding when the question subtracts a negative, and ignoring the
// multiplication order inside a BIDMAS calculation.

const MODES = ['add', 'subtract', 'multiply', 'divide', 'bidmas', 'temperature', 'depth'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Positive magnitudes every mode draws from (the sign is applied by the mode). */
  values: z.array(z.number().int().min(2).max(40)).min(2),
  /** [a, b, c] for a + b × c, where b is drawn negative and c positive. */
  bidmas: z
    .array(z.tuple([z.number().int().min(1).max(30), z.number().int().min(2).max(12), z.number().int().min(2).max(12)]))
    .min(1)
    .default([
      [2, 3, 4],
      [5, 4, 3],
      [10, 2, 6],
    ]),
  /** Starting temperatures (drawn as negative) and the rise applied to them. */
  temperatures: z.array(z.number().int().min(2).max(25)).min(1).default([8, 12, 15]),
  rises: z.array(z.number().int().min(3).max(30)).min(1).default([13, 17, 20]),
  /** Depths below sea level (drawn as negative) and the further dive. */
  depths: z.array(z.number().int().min(10).max(120)).min(1).default([45, 60, 30]),
  dives: z.array(z.number().int().min(5).max(60)).min(1).default([28, 15, 40]),
});
export type DirectedNumbersParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface DirectedValues {
  mode: Mode;
  /** The two signed operands (the basis of the printed expression). */
  a: number;
  b: number;
  /** Third operand for the BIDMAS mode (0 elsewhere). */
  c: number;
  /** The computed answer, always a whole number. */
  answerValue: number;
  /** The printed correct choice, unit-tagged where the mode is a context question. */
  answer: string;
  /** Unit suffix for the context modes ('' elsewhere). */
  unit: string;
}

const EMPTY: Omit<DirectedValues, 'mode' | 'answer' | 'answerValue' | 'unit'> = { a: 0, b: 0, c: 0 };

export function draw(params: DirectedNumbersParams, rng: Rng): DirectedValues {
  const modes = params.modes ?? [...MODES];
  const values = params.values;
  const bidmas = params.bidmas ?? [[2, 3, 4]];
  const temperatures = params.temperatures ?? [8, 12, 15];
  const rises = params.rises ?? [13, 17, 20];
  const depths = params.depths ?? [45, 60, 30];
  const dives = params.dives ?? [28, 15, 40];

  const feasible = modes.filter((mode) => {
    if (mode === 'bidmas') return bidmas.length > 0;
    if (mode === 'temperature') return temperatures.length > 0 && rises.length > 0;
    if (mode === 'depth') return depths.length > 0 && dives.length > 0;
    return values.length >= 2;
  });
  if (feasible.length === 0) {
    throw new Error('math-directed-numbers: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const plain = (a: number, b: number, value: number, unit = ''): DirectedValues => ({
    ...EMPTY,
    mode,
    a,
    b,
    unit,
    answerValue: value,
    answer: unit === '°C' ? `$${fmtNumber(value)}^\\circ\\text{C}$` : unit === 'm' ? `$${fmtNumber(value)}$ metres` : `$${fmtNumber(value)}$`,
  });

  if (mode === 'add') {
    const x = pick(values, rng);
    const y = pick(values, rng);
    const secondNegative = rng() < 0.5;
    const a = -x;
    const b = secondNegative ? -y : y;
    return plain(a, b, a + b);
  }

  if (mode === 'subtract') {
    const x = pick(values, rng);
    const y = pick(values, rng);
    // Two shapes: -x - y (more negative) and x - (-y) (adding on).
    const subtractingNegative = rng() < 0.5;
    const a = subtractingNegative ? x : -x;
    const b = subtractingNegative ? -y : y;
    return plain(a, b, a - b);
  }

  if (mode === 'multiply') {
    const x = pick(values, rng);
    const y = pick(values, rng);
    const a = rng() < 0.5 ? -x : x;
    const b = rng() < 0.5 ? -y : y;
    return plain(a, b, a * b);
  }

  if (mode === 'divide') {
    const divisor = pick(values, rng);
    const quotient = pick(values, rng);
    // The dividend is the product, so the quotient is exact by construction.
    const a = rng() < 0.5 ? -(divisor * quotient) : divisor * quotient;
    const b = rng() < 0.5 ? -divisor : divisor;
    return plain(a, b, a / b);
  }

  if (mode === 'bidmas') {
    const [a, b, c] = pick(bidmas, rng);
    const value = a + -b * c;
    const out = plain(a, -b, value);
    return { ...out, mode, c };
  }

  if (mode === 'temperature') {
    const start = pick(temperatures, rng);
    const rise = pick(rises, rng);
    const out = plain(-start, rise, -start + rise, '°C');
    return { ...out, mode };
  }

  const depth = pick(depths, rng);
  const dive = pick(dives, rng);
  const out = plain(-depth, -dive, -depth - dive, 'm');
  return { ...out, mode };
}

export function build(values: DirectedValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, c, answer, unit } = values;
  const value = values.answerValue;
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(value, candidates, rng).map((v) =>
      unit === '°C' ? `$${fmtNumber(v)}^\\circ\\text{C}$` : unit === 'm' ? `$${fmtNumber(v)}$ metres` : `$${fmtNumber(v)}$`
    ) as [string, string, string];
  /** The sign-blind error: the answer you get by ignoring one minus. */
  const signBlind = Math.abs(value) * (rng() < 0.5 ? 1 : -1);

  if (mode === 'add' || mode === 'subtract') {
    const second = b < 0 ? `(${fmtNumber(b)})` : fmtNumber(b);
    return {
      stem: `What is $${fmtNumber(a)} ${mode === 'add' ? '+' : '-'} ${second}$?`,
      correct: answer,
      distractors: numeric([signBlind, -value, value + 2, Math.abs(a) + Math.abs(b)]),
      explanation:
        mode === 'add'
          ? `Start at $${fmtNumber(a)}$ on the number line and move ${b < 0 ? 'left' : 'right'} by $${fmtNumber(
              Math.abs(b)
            )}$: the answer is $${fmtNumber(value)}$. Adding a negative moves left, exactly like subtracting.`
          : `Subtracting ${second} moves the value ${b < 0 ? 'right (two minuses make a plus)' : 'further left'}: starting at $${fmtNumber(
              a
            )}$, the answer is $${fmtNumber(value)}$.`,
    };
  }

  if (mode === 'multiply') {
    return {
      stem: `What is $(${fmtNumber(a)}) \\times ${b < 0 ? `(${fmtNumber(b)})` : fmtNumber(b)}$?`,
      correct: answer,
      distractors: numeric([a * Math.abs(b), Math.abs(a) * b, value + Math.abs(a), -value]),
      explanation: `Multiply the sizes: $${fmtNumber(Math.abs(a))} \\times ${fmtNumber(
        Math.abs(b)
      )} = ${fmtNumber(Math.abs(value))}$. The signs are ${a < 0 && b < 0 ? 'the same (two negatives), so the answer is positive' : a < 0 || b < 0 ? 'different, so the answer is negative' : 'both positive, so the answer is positive'}: $${fmtNumber(value)}$.`,
    };
  }

  if (mode === 'divide') {
    return {
      stem: `What is $(${fmtNumber(a)}) \\div ${b < 0 ? `(${fmtNumber(b)})` : fmtNumber(b)}$?`,
      correct: answer,
      distractors: numeric([-value, value + 1, a / Math.abs(b), Math.abs(a) / b]),
      explanation: `$${fmtNumber(a)} \\div ${fmtNumber(b)} = ${fmtNumber(value)}$, because $${fmtNumber(
        b
      )} \\times ${fmtNumber(value)} = ${fmtNumber(a)}$. ${
        a < 0 && b < 0 ? 'Two negatives divide to a positive' : 'One negative divides to a negative'
      }.`,
    };
  }

  if (mode === 'bidmas') {
    return {
      stem: `Calculate $${fmtNumber(a)} + (${fmtNumber(b)}) \\times ${fmtNumber(c)}$.`,
      correct: answer,
      distractors: numeric([(a + b) * c, a - b * c, a + b + c, -b * c]),
      explanation: `Multiplication before addition: $(${fmtNumber(b)}) \\times ${fmtNumber(c)} = ${fmtNumber(
        b * c
      )}$. Then $${fmtNumber(a)} + (${fmtNumber(b * c)}) = ${fmtNumber(value)}$. Working left to right would give $${fmtNumber(
        (a + b) * c
      )}$.`,
    };
  }

  if (mode === 'temperature') {
    return {
      stem: `The temperature at midnight was $${fmtNumber(a)}^\\circ\\text{C}$. By 10 am it had risen by $${fmtNumber(
        b
      )}^\\circ\\text{C}$. What was the temperature at 10 am?`,
      correct: answer,
      distractors: numeric([a - b, -a - b, a, b]),
      explanation: `Rising means adding: $${fmtNumber(a)} + ${fmtNumber(b)} = ${fmtNumber(
        value
      )}^\\circ\\text{C}$. Subtracting the rise instead would give $${fmtNumber(a - b)}^\\circ\\text{C}$, which is colder than the start.`,
    };
  }

  return {
    stem: `A submarine is at $${fmtNumber(a)}$ metres (below sea level). It dives another $${fmtNumber(
      Math.abs(b)
    )}$ metres. What is its new depth?`,
    correct: answer,
    distractors: numeric([a + Math.abs(b), Math.abs(a) - Math.abs(b), a, b]),
    explanation: `Diving goes further below zero, so the two depths add in the negative direction: $${fmtNumber(
      a
    )} + (${fmtNumber(b)}) = ${fmtNumber(value)}$ metres.`,
  };
}

export const mathDirectedNumbers: QuestionGenerator<DirectedNumbersParams> = {
  id: 'math-directed-numbers',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
