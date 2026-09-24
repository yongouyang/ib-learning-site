import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pickDistinct, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Place value in other bases: binary to and from base 10, the doubling place values, the
// largest value n bits can hold, and the two hex facts (a digit's value, and the four bits
// it stands for). Every answer is exact by construction — the decimal values ARE the parsed
// binary strings, and the binary strings are produced by the engine's own base conversion,
// so nothing is estimated and no mode can print a non-integer.
//
// Distractors are the named errors: reading a binary string as if it were decimal (1011 ->
// 1011), losing or gaining a place value, and the off-by-one between 2^n and 2^n - 1.

const MODES = [
  'binary-to-decimal',
  'decimal-to-binary',
  'place-value',
  'max-with-bits',
  'hex-digit-value',
  'hex-to-binary',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Binary strings of at least two bits (a one-bit answer is too easy to guess). */
  binaries: z.array(z.string().regex(/^[01]{2,8}$/, 'a binary string of 2–8 bits')).min(2),
  /** Base-10 values for the to-binary direction. */
  decimals: z.array(z.number().int().min(1).max(255)).min(2),
  /** Exponents for the place-value and bit-count modes. */
  bits: z.array(z.number().int().min(2).max(10)).min(1),
  /** Hex digits to read (a value, or the four bits behind it). */
  hexDigits: z.array(z.string().regex(/^[0-9A-F]$/)).min(2).default(['A', 'B', 'C', 'D', 'E', 'F']),
});
export type NumberBasesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface NumberBasesValues {
  mode: Mode;
  /** The binary string in play ('' when the mode has none). */
  binary: string;
  /** The base-10 value in play (0 when the mode has none). */
  decimal: number;
  /** The exponent behind the place-value modes (0 when unused). */
  exponent: number;
  /** The hex digit in play ('' when unused). */
  hex: string;
  /** The printed correct choice. */
  answer: string;
  /** The same answer as a number, for the numeric modes (NaN for the bit-string modes). */
  answerValue: number;
}

const bitString = (n: number): string => n.toString(2);
const hexBits = (hex: string): string => parseInt(hex, 16).toString(2).padStart(4, '0');

const EMPTY: Omit<NumberBasesValues, 'mode' | 'answer' | 'answerValue'> = {
  binary: '',
  decimal: 0,
  exponent: 0,
  hex: '',
};

export function draw(params: NumberBasesParams, rng: Rng): NumberBasesValues {
  const modes = params.modes ?? [...MODES];
  const binaries = params.binaries;
  const decimals = params.decimals;
  const bits = params.bits;
  const hexDigits = params.hexDigits ?? ['A', 'B', 'C', 'D', 'E', 'F'];

  const feasible = modes.filter((mode) => {
    if (mode === 'binary-to-decimal') return binaries.length > 0;
    if (mode === 'decimal-to-binary') return decimals.length > 0;
    if (mode === 'hex-digit-value' || mode === 'hex-to-binary') return hexDigits.length > 0;
    return bits.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-number-bases: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'binary-to-decimal') {
    const binary = pick(binaries, rng);
    const decimal = parseInt(binary, 2);
    return { ...EMPTY, mode, binary, decimal, answer: `$${fmtNumber(decimal)}$`, answerValue: decimal };
  }

  if (mode === 'decimal-to-binary') {
    const decimal = pick(decimals, rng);
    const binary = bitString(decimal);
    return { ...EMPTY, mode, binary, decimal, answer: `$${binary}_2$`, answerValue: NaN };
  }

  if (mode === 'place-value') {
    const exponent = pick(bits, rng);
    const given = 2 ** exponent;
    const answer = 2 ** (exponent + 1);
    return { ...EMPTY, mode, exponent, answer: `$${fmtNumber(answer)}$`, answerValue: answer };
  }

  if (mode === 'max-with-bits') {
    const exponent = pick(bits, rng);
    const answer = 2 ** exponent - 1;
    return { ...EMPTY, mode, exponent, answer: `$${fmtNumber(answer)}$`, answerValue: answer };
  }

  if (mode === 'hex-digit-value') {
    const hex = pick(hexDigits, rng);
    const answer = parseInt(hex, 16);
    return { ...EMPTY, mode, hex, answer: `$${fmtNumber(answer)}$`, answerValue: answer };
  }

  const hex = pick(hexDigits, rng);
  const bits4 = hexBits(hex);
  return { ...EMPTY, mode, hex, binary: bits4, answer: `$${bits4}_2$`, answerValue: NaN };
}

export function build(values: NumberBasesValues, rng: Rng): GeneratorOutput {
  const { mode, binary, decimal, exponent, hex, answer } = values;
  const numeric = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, candidates, rng).map((v) => `$${fmtNumber(v)}$`) as [
      string,
      string,
      string,
    ];
  /** Binary-string distractors: neighbours in value, plus the digit-shift errors. */
  const bitPool = (n: number): string[] => {
    const out: string[] = [];
    for (let delta = 1; delta <= 6; delta++) {
      if (n + delta <= 255) out.push(bitString(n + delta));
      if (n - delta >= 1) out.push(bitString(n - delta));
    }
    out.push(`${bitString(n)}0`, `0${bitString(n)}`, bitString(n).split('').reverse().join(''));
    return out;
  };
  const bitChoices = (n: number): [string, string, string] =>
    uniqueDistractors(`$${bitString(n)}_2$`, bitPool(n), bitPool(n), rng).map((b) => `$${b}_2$`) as [
      string,
      string,
      string,
    ];

  if (mode === 'binary-to-decimal') {
    return {
      stem: `Convert $${binary}_2$ to base 10.`,
      correct: answer,
      distractors: numeric([
        parseInt(binary, 10),
        parseInt(binary, 2) * 2,
        parseInt(binary, 2) / 2,
        parseInt(binary, 2) + 1,
      ]),
      explanation: `The place values double from the right ($1, 2, 4, 8, \\ldots$), so $${binary}_2 = ${binary
        .split('')
        .map((bit, i) => (bit === '1' ? fmtNumber(2 ** (binary.length - 1 - i)) : null))
        .filter((v): v is string => v !== null)
        .join(' + ')} = ${fmtNumber(decimal)}$. Reading $${binary}$ as a decimal number would give $${fmtNumber(parseInt(binary, 10))}$.`,
    };
  }

  if (mode === 'decimal-to-binary') {
    return {
      stem: `Convert $${fmtNumber(decimal)}$ to binary.`,
      correct: answer,
      distractors: bitChoices(decimal),
      explanation: `Take the largest power of two that fits, subtract, and repeat: $${fmtNumber(decimal)} = ${bitPlaces(
        decimal
      )}$, which gives $${bitString(decimal)}_2$.`,
    };
  }

  if (mode === 'place-value') {
    const given = 2 ** exponent;
    return {
      stem: `In binary, the place values run $1, 2, 4, 8, \\ldots$ from the right. What is the next place value after $${fmtNumber(given)}$?`,
      correct: answer,
      distractors: numeric([given, given * 4, given + 2, given / 2]),
      explanation: `Each binary place value is twice the one before it, so after $${fmtNumber(given)} = 2^{${fmtNumber(exponent)}}$ comes $2^{${fmtNumber(exponent + 1)}} = ${fmtNumber(values.answerValue)}$.`,
    };
  }

  if (mode === 'max-with-bits') {
    return {
      stem: `What is the largest number that can be written using exactly $${fmtNumber(exponent)}$ bits?`,
      correct: answer,
      distractors: numeric([2 ** exponent, 2 ** (exponent - 1), 2 ** exponent + 1, 2 ** (exponent + 1) - 1]),
      explanation: `Every one of the $${fmtNumber(exponent)}$ bits is a $1$, so the value is $2^{${fmtNumber(exponent)}} - 1 = ${fmtNumber(values.answerValue)}$; $${fmtNumber(2 ** exponent)}$ would need a ${fmtNumber(exponent + 1)}th bit.`,
    };
  }

  if (mode === 'hex-digit-value') {
    const value = values.answerValue;
    return {
      stem: `In hexadecimal, what value does the digit $${hex}$ represent?`,
      correct: answer,
      distractors: numeric([value - 1, value + 1, value + 10, value - 5]),
      explanation: `Hex counts 0–9 and then $A = 10$, $B = 11$, $C = 12$, $D = 13$, $E = 14$, $F = 15$ — sixteen digits, so $${hex}$ is worth $${fmtNumber(value)}$ (not $${fmtNumber(value + 10)}$).`,
    };
  }

  const bits4 = hexBits(hex);
  return {
    stem: `The hexadecimal digit $${hex}$ is written as which four-bit binary value?`,
    correct: answer,
    distractors: uniqueDistractors(
      `$${bits4}_2$`,
      ['A', 'B', 'C', 'D', 'E', 'F'].filter((d) => d !== hex).map((d) => `$${hexBits(d)}_2$`),
      [
        `$${bits4.split('').reverse().join('')}_2$`,
        `$${bits4.slice(1)}_2$`,
        `$${parseInt(hex, 16).toString(2)}_2$`,
        '$0000_2$',
      ],
      rng
    ),
    explanation: `One hex digit is exactly four bits. $${hex} = ${fmtNumber(parseInt(hex, 16))}$ in base 10, and ${fmtNumber(
      parseInt(hex, 16)
    )} in binary is $${bits4}_2$ (pad to four bits).`,
  };
}

/** The powers of two that sum to n, largest first: "16 + 8 + 1". */
function bitPlaces(n: number): string {
  const parts: string[] = [];
  for (let bit = 7; bit >= 0; bit--) {
    if (n >= 2 ** bit) {
      parts.push(fmtNumber(2 ** bit));
      n -= 2 ** bit;
    }
  }
  return parts.join(' + ');
}

export const mathNumberBases: QuestionGenerator<NumberBasesParams> = {
  id: 'math-number-bases',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
