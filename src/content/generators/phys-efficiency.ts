import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Efficiency = useful output / total input × 100%. Param tables pair totals
// and useful outputs that give clean percentages; useful values larger than
// the drawn total are filtered out.

const DEVICES: [string, string][] = [
  ['lamp', 'as light'],
  ['motor', 'as kinetic energy'],
  ['heater', 'as heat'],
  ['speaker', 'as sound'],
];

export const paramsSchema = z.object({
  total: z.array(z.number().positive()).min(1),
  useful: z.array(z.number().positive()).min(1),
});
export type EfficiencyParams = z.infer<typeof paramsSchema>;

export interface EfficiencyValues {
  total: number;
  useful: number;
  device: string;
  output: string;
  efficiency: number; // percent
}

export function draw(params: EfficiencyParams, rng: Rng): EfficiencyValues {
  const total = pick(params.total, rng);
  const options = params.useful.filter((u) => u < total);
  if (options.length === 0) {
    throw new Error(`phys-efficiency: no useful value below the drawn total ${fmtNumber(total)}`);
  }
  const useful = pick(options, rng);
  const [device, output] = pick(DEVICES, rng);
  return { total, useful, device, output, efficiency: (useful / total) * 100 };
}

export function build(values: EfficiencyValues, rng: Rng): GeneratorOutput {
  const { total, useful, device, output, efficiency } = values;
  // Error rules: the wasted percentage, total/useful (inverted ratio),
  // useful/total without the ×100, and nearby slips for collision-heavy draws
  // (e.g. exactly 50%, where the wasted percentage IS the answer). The inverted
  // ratio is rarely clean (500/60) — round to 2dp so the displayed choice stays
  // readable ("8.33%", not "8.333333%").
  const inverted = Math.round((total / useful) * 100) / 100;
  const distractorValues = uniqueNumericDistractors(
    efficiency,
    [100 - efficiency, inverted, useful / total, efficiency + 10, efficiency / 2],
    rng
  );
  // At exactly 50% the wasted-percentage distractor collides with the answer
  // and is dropped, so only name it when it is actually offered.
  const wastedNote =
    efficiency === 50 ? '' : ` The ${fmtNumber(100 - efficiency)}% option is the wasted percentage, not the efficiency.`;
  return {
    stem: `A ${device} takes in ${fmtNumber(total)} J of electrical energy and transfers ${fmtNumber(useful)} J ${output}. What is its efficiency?`,
    correct: `${fmtNumber(efficiency)}%`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)}%`) as [string, string, string],
    explanation: String.raw`Efficiency $=\dfrac{\text{useful output}}{\text{total input}}\times100\%=\dfrac{${fmtNumber(useful)}}{${fmtNumber(total)}}\times100\%=${fmtNumber(efficiency)}\%$.${wastedNote}`,
  };
}

export const physEfficiency: QuestionGenerator<EfficiencyParams> = {
  id: 'phys-efficiency',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
