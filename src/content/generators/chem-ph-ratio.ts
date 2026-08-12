import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// pH as a logarithmic scale: a difference of n pH units is a 10^n change in
// hydrogen-ion concentration. Choices are plain numbers (10, 100, 1000).

export const paramsSchema = z.object({
  /** Candidate pH differences (1..3 -> factors of 10, 100, 1000). */
  deltaPowers: z.array(z.number().int().min(1).max(3)).min(1),
  /** Also ask the alkaline mirror question (defaults to true). */
  includeAlkaline: z.boolean().optional(),
});
export type PhRatioParams = z.infer<typeof paramsSchema>;

export interface PhRatioValues {
  mode: 'acidic' | 'alkaline';
  delta: number;
  /** Lower pH (more acidic solution in acidic mode). */
  phLow: number;
  /** Higher pH (more alkaline solution in alkaline mode). */
  phHigh: number;
}

export function draw(params: PhRatioParams, rng: Rng): PhRatioValues {
  const delta = pick(params.deltaPowers, rng);
  const modes: Array<'acidic' | 'alkaline'> =
    params.includeAlkaline === false ? ['acidic'] : ['acidic', 'alkaline'];
  const mode = pick(modes, rng);
  if (mode === 'acidic') {
    const phLow = 1 + Math.floor(rng() * (7 - delta)); // 1 .. 7-delta
    return { mode, delta, phLow, phHigh: phLow + delta };
  }
  const phHigh = 7 + delta + Math.floor(rng() * (15 - (7 + delta))); // 7+delta .. 14
  return { mode, delta, phLow: phHigh - delta, phHigh };
}

export function build(values: PhRatioValues, rng: Rng): GeneratorOutput {
  const { mode, delta, phLow, phHigh } = values;
  const factor = 10 ** delta;
  // Error rules: the pH difference itself, delta x 10, 2^delta, and 10^(delta +/- 1).
  const distractorValues = uniqueNumericDistractors(
    factor,
    [delta, delta * 10, 2 ** delta, 10 ** (delta - 1), 10 ** (delta + 1)],
    rng
  );
  const distractors = distractorValues.map((d) => fmtNumber(d)) as [string, string, string];
  if (mode === 'acidic') {
    return {
      stem: `Solution A has a pH of ${phHigh}. Solution B has a pH of ${phLow}. How many times more acidic is solution B than solution A?`,
      correct: fmtNumber(factor),
      distractors,
      explanation: String.raw`Each pH unit is a factor of 10 in hydrogen-ion concentration: $\Delta\text{pH}=${phHigh}-${phLow}=${delta}$, so solution B has $10^{${delta}}=${fmtNumber(factor)}$ times as many hydrogen ions — ${fmtNumber(factor)} times more acidic. The answer is not the pH difference itself (${delta}).`,
    };
  }
  return {
    stem: `Solution A has a pH of ${phLow}. Solution B has a pH of ${phHigh}. How many times more alkaline is solution B than solution A?`,
    correct: fmtNumber(factor),
    distractors,
    explanation: String.raw`The same log scale applies at the alkaline end: each pH unit up means 10 times more hydroxide ions: $\Delta\text{pH}=${phHigh}-${phLow}=${delta}$, so solution B is $10^{${delta}}=${fmtNumber(factor)}$ times more alkaline. The answer is not the pH difference itself (${delta}).`,
  };
}

export const chemPhRatio: QuestionGenerator<PhRatioParams> = {
  id: 'chem-ph-ratio',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
