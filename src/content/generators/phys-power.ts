import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Power from work: P = W/t = F*d/t. Distance/time pairs are filtered so the
// division is always clean for the drawn force.

const SCENARIOS: [string, string][] = [
  ['crane lifts a', 'crate'],
  ['hoist raises a', 'engine block'],
  ['worker pushes a', 'trolley'],
  ['winch pulls a', 'load'],
];

export const paramsSchema = z.object({
  force: z.array(z.number().positive()).min(1),
  distance: z.array(z.number().positive()).min(1),
  time: z.array(z.number().positive()).min(1),
});
export type PowerParams = z.infer<typeof paramsSchema>;

export interface PowerValues {
  f: number;
  d: number;
  t: number;
  work: number;
  power: number;
  verb: string;
  object: string;
}

export function draw(params: PowerParams, rng: Rng): PowerValues {
  const f = pick(params.force, rng);
  const pairs: [number, number][] = [];
  for (const d of params.distance) {
    for (const t of params.time) {
      if ((f * d) % t === 0) pairs.push([d, t]);
    }
  }
  if (pairs.length === 0) {
    throw new Error(`phys-power: no distance/time pair divides cleanly for force ${fmtNumber(f)}`);
  }
  const [d, t] = pick(pairs, rng);
  const [verb, object] = pick(SCENARIOS, rng);
  const work = f * d;
  return { f, d, t, work, power: work / t, verb, object };
}

export function build(values: PowerValues, rng: Rng): GeneratorOutput {
  const { f, d, t, work, power, verb, object } = values;
  // Error rules: F*d (forgets the time), F/t (forgets the distance), and
  // F*d*t (multiplies through instead of dividing).
  const distractorValues = uniqueNumericDistractors(power, [work, f / t, work * t], rng);
  return {
    stem: `A ${verb} ${fmtNumber(f)} N ${object} through ${fmtNumber(d)} m in ${fmtNumber(t)} s. What is its power output?`,
    correct: `${fmtNumber(power)} W`,
    distractors: distractorValues.map((v) => `${fmtNumber(v)} W`) as [string, string, string],
    explanation: String.raw`Work done first: $W=Fd=${fmtNumber(f)}\times${fmtNumber(d)}=${fmtNumber(work)}\text{ J}$. Then $P=\dfrac{W}{t}=\dfrac{${fmtNumber(work)}}{${fmtNumber(t)}}=${fmtNumber(power)}\text{ W}$. The ${fmtNumber(work)} W option forgets to divide by the time.`,
  };
}

export const physPower: QuestionGenerator<PowerParams> = {
  id: 'phys-power',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
