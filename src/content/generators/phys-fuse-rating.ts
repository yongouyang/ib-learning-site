import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick } from './utils';

// Fuse selection: I = P/V on 230 V mains, then the smallest standard fuse
// (3 A, 5 A, 13 A) above the operating current. Param tables choose wattages
// whose currents land clearly inside one fuse band.

const STANDARD_FUSES = [3, 5, 13];
const APPLIANCES = ['microwave', 'heater', 'kettle', 'toaster', 'washing machine', 'hair dryer'];

export const paramsSchema = z.object({
  watts: z.array(z.number().positive()).min(1),
});
export type FuseRatingParams = z.infer<typeof paramsSchema>;

export interface FuseRatingValues {
  watts: number;
  appliance: string;
  extra: string; // the non-standard fourth choice
  current: number;
  fuse: number;
}

export function draw(params: FuseRatingParams, rng: Rng): FuseRatingValues {
  const watts = pick(params.watts, rng);
  const appliance = pick(APPLIANCES, rng);
  const extra = pick(['1 A', '30 A'], rng);
  const current = watts / 230;
  const fuse = STANDARD_FUSES.find((f) => current < f);
  if (fuse === undefined) {
    throw new Error(`phys-fuse-rating: ${fmtNumber(watts)} W draws ${fmtNumber(current)} A — above the 13 A standard fuse`);
  }
  return { watts, appliance, extra, current, fuse };
}

export function build(values: FuseRatingValues): GeneratorOutput {
  const { watts, appliance, extra, current, fuse } = values;
  // Distractors: the two standard fuses that were not chosen, plus one
  // implausible rating drawn in draw().
  const distractors = STANDARD_FUSES.filter((f) => f !== fuse).map((f) => `${f} A`);
  return {
    stem: `A ${fmtNumber(watts)} W ${appliance} runs on the 230 V mains supply. Which fuse rating should be fitted?`,
    correct: `${fuse} A`,
    distractors: [distractors[0], distractors[1], extra],
    explanation: String.raw`$I=\dfrac{P}{V}=\dfrac{${fmtNumber(watts)}}{230}=${fmtNumber(current)}\text{ A}$. Choose the next standard rating above ${fmtNumber(current)} A, so a ${fuse} A fuse. A lower fuse would melt in normal use; a higher one would not protect properly.`,
  };
}

export const physFuseRating: QuestionGenerator<FuseRatingParams> = {
  id: 'phys-fuse-rating',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng));
  },
};
