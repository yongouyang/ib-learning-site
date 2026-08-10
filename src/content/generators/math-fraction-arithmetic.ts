import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { gcd, pick } from './utils';

// Add two proper fractions with different denominators; the answer is given
// in simplest form via \dfrac. Numerators are drawn in 1..min(maxNum, den-1)
// so every fraction is proper.

export const paramsSchema = z.object({
  den1: z.array(z.number().int().min(2)).min(1),
  den2: z.array(z.number().int().min(2)).min(1),
  maxNum: z.number().int().min(1),
});
export type FractionArithmeticParams = z.infer<typeof paramsSchema>;

export interface FractionArithmeticValues {
  n1: number;
  d1: number;
  n2: number;
  d2: number;
}

export function draw(params: FractionArithmeticParams, rng: Rng): FractionArithmeticValues {
  const d1 = pick(params.den1, rng);
  const d2options = params.den2.filter((d) => d !== d1);
  if (d2options.length === 0) {
    throw new Error('math-fraction-arithmetic: den2 has no value different from the drawn den1');
  }
  const d2 = pick(d2options, rng);
  return { n1: drawNumerator(d1, params.maxNum, rng), d1, n2: drawNumerator(d2, params.maxNum, rng), d2 };
}

// Numerators coprime to the denominator keep the stem fractions in lowest
// terms (asking $\dfrac{1}{4} + \dfrac{3}{6}$ would look sloppy).
function drawNumerator(den: number, maxNum: number, rng: Rng): number {
  const cap = Math.min(maxNum, den - 1);
  const coprime: number[] = [];
  for (let n = 1; n <= cap; n++) {
    if (gcd(n, den) === 1) coprime.push(n);
  }
  const options =
    coprime.length > 0 ? coprime : Array.from({ length: cap }, (_, k) => k + 1);
  return pick(options, rng);
}

function fmtFraction(num: number, den: number): string {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  return d === 1 ? String(n) : String.raw`\dfrac{${n}}{${d}}`;
}

// Three unique distractors from common-error candidate fractions. If the
// candidates collide with each other or the answer, the last candidate's
// numerator is stepped up until three unique values exist.
function uniqueFractionDistractors(
  correct: string,
  candidates: [number, number][]
): [string, string, string] {
  const used = new Set([correct]);
  const picked: string[] = [];
  for (const [num, den] of candidates) {
    if (picked.length === 3) break;
    if (num <= 0) continue;
    const s = fmtFraction(num, den);
    if (used.has(s)) continue;
    used.add(s);
    picked.push(s);
  }
  const [lastNum, lastDen] = candidates[candidates.length - 1] ?? [1, 2];
  let step = 1;
  while (picked.length < 3) {
    const s = fmtFraction(lastNum + step, lastDen);
    step += 1;
    if (used.has(s)) continue;
    used.add(s);
    picked.push(s);
  }
  return picked as [string, string, string];
}

export function build(values: FractionArithmeticValues): GeneratorOutput {
  const { n1, d1, n2, d2 } = values;
  const lcm = (d1 * d2) / gcd(d1, d2);
  const scaled1 = n1 * (lcm / d1);
  const scaled2 = n2 * (lcm / d2);
  const num = scaled1 + scaled2;
  const correct = fmtFraction(num, lcm);
  // Error rules: add numerators AND denominators straight across; use the
  // common denominator but scale only one of the two numerators.
  const distractors = uniqueFractionDistractors(correct, [
    [n1 + n2, d1 + d2],
    [scaled1 + n2, lcm],
    [n1 + scaled2, lcm],
  ]);
  const simplified =
    gcd(num, lcm) > 1 ? String.raw`, which simplifies to $\dfrac{${num / gcd(num, lcm)}}{${lcm / gcd(num, lcm)}}$` : '';
  return {
    stem: String.raw`Find $\dfrac{${n1}}{${d1}} + \dfrac{${n2}}{${d2}}$. Give your answer in its simplest form.`,
    correct: `$${correct}$`,
    distractors: distractors.map((d) => `$${d}$`) as [string, string, string],
    explanation: String.raw`The lowest common denominator of ${d1} and ${d2} is ${lcm}: $\dfrac{${n1}}{${d1}} = \dfrac{${scaled1}}{${lcm}}$ and $\dfrac{${n2}}{${d2}} = \dfrac{${scaled2}}{${lcm}}$. Add the numerators: $\dfrac{${num}}{${lcm}}$${simplified}.`,
  };
}

export const mathFractionArithmetic: QuestionGenerator<FractionArithmeticParams> = {
  id: 'math-fraction-arithmetic',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng));
  },
};
