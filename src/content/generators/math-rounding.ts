import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors } from './utils';

// Rounding to a given number of decimal places or significant figures — the most
// reused numerical skill in the corpus (rounding/estimation, error intervals,
// standard form, transformations, DP statistics and kinematics), so one
// generator serves many host topics.
//
// Two design points that this generator exists to get right:
//
// 1. Rounding uses the exponent-shift trick, NOT `Math.round(x * 100) / 100`.
//    The naive form is wrong for values like 2.675, whose binary value is
//    2.67499999… — the classic "0.5 rounds the wrong way" bug.
// 2. Distractors are built as DISPLAY STRINGS and never re-round. An earlier
//    version passed candidate numbers back through the same formatter as the
//    answer, which collapsed every "rounding too finely" distractor (2.7 for a
//    1-s.f. question) back onto the correct answer and then threw for want of
//    three unique choices. The candidates below are formatted once, at the
//    precision they represent.

export const paramsSchema = z
  .object({
    /** Decimal places to round to. */
    dp: z.array(z.number().int().min(0).max(4)).min(1).optional(),
    /** Significant figures to round to. */
    sf: z.array(z.number().int().min(1).max(4)).min(1).optional(),
    /** Positive values to round. Give more decimals than the largest dp so the skill bites. */
    values: z.array(z.number().positive()).min(3),
  })
  .refine((p) => p.dp !== undefined || p.sf !== undefined, {
    message: 'rounding: at least one of dp or sf is required',
  });
export type RoundingParams = z.infer<typeof paramsSchema>;

export interface RoundingValues {
  mode: 'dp' | 'sf';
  /** Decimal places or significant figures, depending on mode. */
  target: number;
  value: number;
  answer: number;
}

/** Round to `dp` decimal places without binary-float surprises. */
export function roundDp(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const shifted = Number(`${value}e${dp}`);
  if (!Number.isFinite(shifted)) return value;
  return Number(`${Math.round(shifted)}e-${dp}`);
}

/** Round to `sf` significant figures (0 stays 0; values below 1 work). */
export function roundSf(value: number, sf: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const shift = sf - 1 - exponent;
  const shifted = Number(`${value}e${shift}`);
  if (!Number.isFinite(shifted)) return value;
  // Note `${-shift}`: shift is negative for values >= 10^sf, and writing
  // `e-${shift}` there would produce "e--2" and silently yield NaN.
  return Number(`${Math.round(shifted)}e${-shift}`);
}

/** Truncate toward zero at the question's precision — the "chop, don't round" error. */
export function chop(value: number, mode: 'dp' | 'sf', target: number): number {
  if (mode === 'dp') {
    const factor = 10 ** target;
    return Math.trunc(value * factor) / factor;
  }
  const unit = unitInLastPlace(value, mode, target);
  return Math.trunc(value / unit) * unit;
}

/** The value of one unit in the last kept place (0.01 for 2 d.p.; 10 for 2 s.f. of 3456). */
function unitInLastPlace(value: number, mode: 'dp' | 'sf', target: number): number {
  if (mode === 'dp') return 10 ** -target;
  const exponent = Math.floor(Math.log10(Math.abs(value) || 1));
  return 10 ** (exponent - target + 1);
}

export function draw(params: RoundingParams, rng: Rng): RoundingValues {
  const modes: ('dp' | 'sf')[] = [];
  if (params.dp?.length) modes.push('dp');
  if (params.sf?.length) modes.push('sf');
  const mode = pick(modes, rng);
  const target = mode === 'dp' ? pick(params.dp!, rng) : pick(params.sf!, rng);
  const value = pick(params.values, rng);
  const answer = mode === 'dp' ? roundDp(value, target) : roundSf(value, target);
  return { mode, target, value, answer };
}

/** The correct answer, padded to the question's precision — the trailing zero in "3.40" matters. */
function padded(value: number, mode: 'dp' | 'sf', target: number): string {
  if (mode === 'dp') return roundDp(value, target).toFixed(target);
  const rounded = roundSf(value, target);
  // Only pad below 1, where significant figures really are decimal places.
  return Math.abs(rounded) < 1 ? String(rounded) : fmtNumber(rounded);
}

export function build(values: RoundingValues, rng: Rng): GeneratorOutput {
  const { mode, target, value, answer } = values;
  const place =
    mode === 'dp'
      ? `${target} decimal place${target === 1 ? '' : 's'}`
      : `${target} significant figure${target === 1 ? '' : 's'}`;
  const correct = padded(answer, mode, target);
  const unit = unitInLastPlace(value, mode, target);

  // Error rules, as display strings: not rounding at all, chopping instead of
  // rounding, rounding at the wrong precision (both ways), and a last-place slip.
  const candidates: string[] = [
    fmtNumber(value),
    fmtNumber(chop(value, mode, target)),
    padded(value, mode, target + 1),
    padded(value, mode, Math.max(mode === 'dp' ? 0 : 1, target - 1)),
    padded(answer - unit, mode, target),
    padded(answer + unit, mode, target),
  ];
  const fallback: string[] = [
    padded(answer - 2 * unit, mode, target),
    padded(answer + 2 * unit, mode, target),
    padded(answer - 3 * unit, mode, target),
    padded(answer + 3 * unit, mode, target),
    fmtNumber(chop(value, mode, target + 1)),
  ];

  const deciding =
    mode === 'dp'
      ? `Look at the digit after the ${target}${ordinal(target)} decimal place`
      : `Count significant figures from the first non-zero digit`;
  return {
    stem: `Round ${fmtNumber(value)} to ${place}.`,
    correct,
    distractors: uniqueDistractors(correct, candidates, fallback, rng),
    explanation: `${deciding}. Rounding ${fmtNumber(value)} to ${place} gives ${correct}.${
      fmtNumber(chop(value, mode, target)) === correct
        ? ' The deciding digit is 4 or less, so the previous digit does not change.'
        : ` Chopping the remaining digits instead of rounding would give ${fmtNumber(chop(value, mode, target))}, which is wrong.`
    }`,
  };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export const mathRounding: QuestionGenerator<RoundingParams> = {
  id: 'math-rounding',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
