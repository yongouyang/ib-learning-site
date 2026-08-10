import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Charge from current and time: Q = I*t. When the drawn time is a whole number
// of minutes the question may present it in minutes — the min -> s conversion
// is then the trap.

export const paramsSchema = z.object({
  i: z.array(z.number().positive()).min(1),
  tSeconds: z.array(z.number().positive()).min(1),
});
export type ChargeCurrentParams = z.infer<typeof paramsSchema>;

export interface ChargeCurrentValues {
  i: number;
  t: number; // seconds
  inMinutes: boolean;
  q: number;
}

export function draw(params: ChargeCurrentParams, rng: Rng): ChargeCurrentValues {
  const i = pick(params.i, rng);
  const t = pick(params.tSeconds, rng);
  const inMinutes = t % 60 === 0 && pick([false, true], rng);
  return { i, t, inMinutes, q: i * t };
}

export function build(values: ChargeCurrentValues, rng: Rng): GeneratorOutput {
  const { i, t, inMinutes, q } = values;
  if (inMinutes) {
    const minutes = t / 60;
    // Error rules: I×minutes (no conversion), adding, the time alone, and
    // half the charge (random halving slip).
    const distractorValues = uniqueNumericDistractors(
      q,
      [i * minutes, i + minutes, t, q / 2],
      rng
    );
    return {
      stem: `A current of ${fmtNumber(i)} A flows through a wire for ${fmtNumber(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}. How much charge passes?`,
      correct: `${fmtNumber(q)} C`,
      distractors: distractorValues.map((d) => `${fmtNumber(d)} C`) as [string, string, string],
      explanation: String.raw`Convert minutes to seconds first: ${fmtNumber(minutes)} min = ${fmtNumber(t)} s. Then $Q=It=${fmtNumber(i)}\times${fmtNumber(t)}=${fmtNumber(q)}\text{ C}$. Using ${fmtNumber(minutes)} instead of ${fmtNumber(t)} gives the ${fmtNumber(i * minutes)} C trap.`,
    };
  }
  // Error rules: adding instead of multiplying, I/t (inverted), the time
  // alone, and half the charge.
  const distractorValues = uniqueNumericDistractors(q, [i + t, t / i, t, q / 2], rng);
  return {
    stem: `A current of ${fmtNumber(i)} A flows through a wire for ${fmtNumber(t)} seconds. How much charge passes?`,
    correct: `${fmtNumber(q)} C`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)} C`) as [string, string, string],
    explanation: String.raw`Charge is current times time: $Q=It=${fmtNumber(i)}\times${fmtNumber(t)}=${fmtNumber(q)}\text{ C}$.`,
  };
}

export const physChargeCurrent: QuestionGenerator<ChargeCurrentParams> = {
  id: 'phys-charge-current',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
