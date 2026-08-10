import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Ohm's law V = IR, randomly asking for V, I or R. Param tables use values
// with clean products so every answer is mental-math friendly.

export const paramsSchema = z.object({
  r: z.array(z.number().positive()).min(1),
  i: z.array(z.number().positive()).min(1),
});
export type OhmsLawParams = z.infer<typeof paramsSchema>;

export interface OhmsLawValues {
  r: number;
  i: number;
  v: number;
  ask: 'V' | 'I' | 'R';
}

export function draw(params: OhmsLawParams, rng: Rng): OhmsLawValues {
  const r = pick(params.r, rng);
  const i = pick(params.i, rng);
  const ask = pick(['V', 'I', 'R'] as const, rng);
  return { r, i, v: r * i, ask };
}

// Negative or zero distractors are not plausible for these quantities, so
// candidates are filtered before the uniqueness pass.
function distractorsFor(correct: number, candidates: number[], unit: string, rng: Rng) {
  return uniqueNumericDistractors(
    correct,
    candidates.filter((n) => n > 0),
    rng
  ).map((d) => `${fmtNumber(d)} ${unit}`) as [string, string, string];
}

export function build(values: OhmsLawValues, rng: Rng): GeneratorOutput {
  const { r, i, v, ask } = values;
  if (ask === 'V') {
    // Error rules: I/R (inverted), R+I and R-I (adding instead of multiplying).
    return {
      stem: `A current of I = ${fmtNumber(i)} A flows through a resistor of R = ${fmtNumber(r)} Ω. What is the voltage across it?`,
      correct: `${fmtNumber(v)} V`,
      distractors: distractorsFor(v, [i / r, r + i, r - i], 'V', rng),
      explanation: String.raw`Using Ohm's Law: $V=IR=${fmtNumber(i)}\times${fmtNumber(r)}=${fmtNumber(v)}\text{ V}$.`,
    };
  }
  if (ask === 'I') {
    // Error rules: V×R (multiplying), R/V (inverted division), V−R (subtracting).
    return {
      stem: `A resistor of R = ${fmtNumber(r)} Ω has a voltage of V = ${fmtNumber(v)} V across it. What current flows through it?`,
      correct: `${fmtNumber(i)} A`,
      distractors: distractorsFor(i, [v * r, r / v, v - r], 'A', rng),
      explanation: String.raw`Rearranging Ohm's Law: $I=\dfrac{V}{R}=\dfrac{${fmtNumber(v)}}{${fmtNumber(r)}}=${fmtNumber(i)}\text{ A}$.`,
    };
  }
  // ask === 'R' — error rules: V×I, I/V, V−I.
  return {
    stem: `A component has V = ${fmtNumber(v)} V across it and carries a current of I = ${fmtNumber(i)} A. What is its resistance?`,
    correct: `${fmtNumber(r)} Ω`,
    distractors: distractorsFor(r, [v * i, i / v, v - i], 'Ω', rng),
    explanation: String.raw`Rearranging Ohm's Law: $R=\dfrac{V}{I}=\dfrac{${fmtNumber(v)}}{${fmtNumber(i)}}=${fmtNumber(r)}\ \Omega$.`,
  };
}

export const physVIr: QuestionGenerator<OhmsLawParams> = {
  id: 'phys-v-ir',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
