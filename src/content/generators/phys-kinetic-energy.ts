import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Kinetic energy: KE = ½mv². Param tables keep m*v² even so the answer is an
// integer (e.g. restrict v to even values).

export const paramsSchema = z.object({
  m: z.array(z.number().positive()).min(1),
  v: z.array(z.number().positive()).min(1),
});
export type KineticEnergyParams = z.infer<typeof paramsSchema>;

export interface KineticEnergyValues {
  m: number;
  v: number;
  ke: number;
}

export function draw(params: KineticEnergyParams, rng: Rng): KineticEnergyValues {
  const m = pick(params.m, rng);
  const v = pick(params.v, rng);
  return { m, v, ke: 0.5 * m * v * v };
}

export function build(values: KineticEnergyValues, rng: Rng): GeneratorOutput {
  const { m, v, ke } = values;
  // Error rules: mv² (forgot the ½), mv (forgot both), ½mv (forgot the square).
  const distractorValues = uniqueNumericDistractors(ke, [m * v * v, m * v, 0.5 * m * v], rng);
  return {
    stem: `A ${fmtNumber(m)} kg object moves at ${fmtNumber(v)} m/s. What is its kinetic energy?`,
    correct: `${fmtNumber(ke)} J`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)} J`) as [string, string, string],
    explanation: String.raw`$KE=\dfrac{1}{2}mv^2=\dfrac{1}{2}\times${fmtNumber(m)}\times${fmtNumber(v)}^2=\dfrac{1}{2}\times${fmtNumber(m)}\times${fmtNumber(v * v)}=${fmtNumber(ke)}\text{ J}$. Remember to square the speed before multiplying.`,
  };
}

export const physKineticEnergy: QuestionGenerator<KineticEnergyParams> = {
  id: 'phys-kinetic-energy',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
