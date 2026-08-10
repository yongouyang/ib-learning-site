import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Two resistors in parallel: R = R1*R2 / (R1 + R2). Param tables list pairs
// with clean product/sum (e.g. 6 Ω ∥ 3 Ω = 2 Ω).

export const paramsSchema = z.object({
  pairs: z.array(z.tuple([z.number().positive(), z.number().positive()])).min(1),
});
export type ParallelResistanceParams = z.infer<typeof paramsSchema>;

export interface ParallelResistanceValues {
  r1: number;
  r2: number;
  total: number;
}

export function draw(params: ParallelResistanceParams, rng: Rng): ParallelResistanceValues {
  const [r1, r2] = pick(params.pairs, rng);
  return { r1, r2, total: (r1 * r2) / (r1 + r2) };
}

export function build(values: ParallelResistanceValues, rng: Rng): GeneratorOutput {
  const { r1, r2, total } = values;
  const article = (n: number) => (/^(8|11|18)/.test(fmtNumber(n)) ? 'An' : 'A');
  // Error rules: the series sum, the mean of the two, and the inverted formula.
  const distractorValues = uniqueNumericDistractors(
    total,
    [r1 + r2, (r1 + r2) / 2, (r1 + r2) / (r1 * r2)],
    rng
  );
  return {
    stem: `${article(r1)} ${fmtNumber(r1)} Ω and ${article(r2).toLowerCase()} ${fmtNumber(r2)} Ω resistor are connected in parallel. What is the total resistance?`,
    correct: `${fmtNumber(total)} Ω`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)} Ω`) as [string, string, string],
    explanation: String.raw`For two resistors in parallel: $R=\dfrac{R_1 R_2}{R_1+R_2}=\dfrac{${fmtNumber(r1)}\times${fmtNumber(r2)}}{${fmtNumber(r1)}+${fmtNumber(r2)}}=\dfrac{${fmtNumber(r1 * r2)}}{${fmtNumber(r1 + r2)}}=${fmtNumber(total)}\ \Omega$. The ${fmtNumber(r1 + r2)} Ω option is the series sum — adding is wrong for parallel.`,
  };
}

export const physResistanceParallel: QuestionGenerator<ParallelResistanceParams> = {
  id: 'phys-resistance-parallel',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
