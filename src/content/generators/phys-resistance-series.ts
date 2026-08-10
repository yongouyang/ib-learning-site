import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pickDistinct, uniqueNumericDistractors } from './utils';

// Total resistance of 2–3 distinct resistors in series: R = R1 + R2 (+ R3).

export const paramsSchema = z.object({
  values: z.array(z.number().positive()).min(3),
});
export type SeriesResistanceParams = z.infer<typeof paramsSchema>;

export interface SeriesResistanceValues {
  resistors: number[];
  total: number;
}

export function draw(params: SeriesResistanceParams, rng: Rng): SeriesResistanceValues {
  const count = 2 + Math.floor(rng() * 2); // 2 or 3 resistors
  const resistors = pickDistinct(params.values, count, rng);
  return { resistors, total: resistors.reduce((sum, r) => sum + r, 0) };
}

export function build(values: SeriesResistanceValues, rng: Rng): GeneratorOutput {
  const { resistors, total } = values;
  const product = resistors.reduce((acc, r) => acc * r, 1);
  // Error rules: multiplying instead of adding, applying the parallel formula
  // (product/sum — only offered when it comes out clean), dropping one
  // resistor from the sum, and keeping just the largest resistor.
  const parallel = product / total;
  const candidates = [product];
  if (Math.abs(parallel - Math.round(parallel * 100) / 100) < 1e-9) candidates.push(parallel);
  candidates.push(total - Math.min(...resistors), Math.max(...resistors));
  const distractorValues = uniqueNumericDistractors(total, candidates, rng);
  const list =
    resistors.length === 2
      ? `${fmtNumber(resistors[0])} Ω and ${fmtNumber(resistors[1])} Ω`
      : `${fmtNumber(resistors[0])} Ω, ${fmtNumber(resistors[1])} Ω and ${fmtNumber(resistors[2])} Ω`;
  const word = resistors.length === 2 ? 'Two' : 'Three';
  const sumExpr = resistors.map(fmtNumber).join('+');
  return {
    stem: `${word} resistors, ${list}, are connected in series. What is the total resistance?`,
    correct: `${fmtNumber(total)} Ω`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)} Ω`) as [string, string, string],
    explanation: String.raw`In series, resistances add: $R=${sumExpr}=${fmtNumber(total)}\ \Omega$. Adding is correct for series — the parallel formula would give a smaller value.`,
  };
}

export const physResistanceSeries: QuestionGenerator<SeriesResistanceParams> = {
  id: 'phys-resistance-series',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
