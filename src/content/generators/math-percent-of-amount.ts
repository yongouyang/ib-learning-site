import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Find p% of n. Param tables should keep p*n divisible by 100 so the answer
// is an integer (e.g. p a multiple of 5, n a multiple of 20).

export const paramsSchema = z.object({
  p: z.array(z.number()).min(1),
  n: z.array(z.number()).min(1),
});
export type PercentOfAmountParams = z.infer<typeof paramsSchema>;

export interface PercentOfAmountValues {
  p: number;
  n: number;
  answer: number;
}

export function draw(params: PercentOfAmountParams, rng: Rng): PercentOfAmountValues {
  const p = pick(params.p, rng);
  const n = pick(params.n, rng);
  return { p, n, answer: (p * n) / 100 };
}

export function build(values: PercentOfAmountValues, rng: Rng): GeneratorOutput {
  const { p, n, answer } = values;
  // Error rules: dividing by 100 twice, a x10 place-value slip, and adding
  // instead of multiplying.
  const distractorValues = uniqueNumericDistractors(
    answer,
    [answer / 100, answer * 10, p + n],
    rng
  );
  return {
    stem: `Find ${fmtNumber(p)}% of ${fmtNumber(n)}.`,
    correct: fmtNumber(answer),
    distractors: distractorValues.map(fmtNumber) as [string, string, string],
    explanation: `Use the multiplier ${fmtNumber(p / 100)}: ${fmtNumber(n)} × ${fmtNumber(p / 100)} = ${fmtNumber(answer)}. So ${fmtNumber(p)}% of ${fmtNumber(n)} is ${fmtNumber(answer)}.`,
  };
}

export const mathPercentOfAmount: QuestionGenerator<PercentOfAmountParams> = {
  id: 'math-percent-of-amount',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
