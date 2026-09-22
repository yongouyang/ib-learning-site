import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Histogram frequency density: the three-way relationship
// frequency = frequency density x class width, asked in each direction.
//
// The frequency is BUILT from an integer density and an integer width, so all
// three answers are whole numbers whichever way the question is asked — the
// 0.33-style answers the corpus contains come from dividing badly, and a generated
// item should not depend on a rounding convention it never states.
//
// Distractors are the named errors: multiplying where the question divides (and
// vice versa), swapping the two given numbers, and answering with one of the
// given values instead of the one asked for.

const MODES = ['density', 'frequency', 'width'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Frequency densities to draw. */
  densities: z.array(z.number().int().min(2).max(12)).min(1),
  /** Class widths to draw. */
  widths: z.array(z.number().int().min(2).max(25)).min(1),
});
export type FrequencyDensityParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface FrequencyDensityValues {
  mode: Mode;
  density: number;
  width: number;
  frequency: number;
}

export function draw(params: FrequencyDensityParams, rng: Rng): FrequencyDensityValues {
  // Normalise the schema default here too — draw() is called with a plain object
  // by unit tests and future callers.
  const mode = pick(params.modes ?? [...MODES], rng);
  const density = pick(params.densities, rng);
  const width = pick(params.widths, rng);
  return { mode, density, width, frequency: density * width };
}

export function build(values: FrequencyDensityValues, rng: Rng): GeneratorOutput {
  const { mode, density, width, frequency } = values;

  if (mode === 'density') {
    const stem = `A class has frequency ${frequency} and class width ${width}. What is the frequency density?`;
    const distractors = uniqueNumericDistractors(density, [frequency, width, density + 1, frequency / 2], rng).map(
      (v) => fmtNumber(v)
    ) as [string, string, string];
    const note = distractors.includes(fmtNumber(frequency))
      ? ` The option ${frequency} multiplies instead of dividing.`
      : '';
    return {
      stem,
      correct: fmtNumber(density),
      distractors,
      explanation: `Frequency density = frequency ÷ class width = $${frequency} \\div ${width} = ${density}$.${note}`,
    };
  }

  if (mode === 'frequency') {
    const stem = `A histogram bar for a class of width ${width} has a height (frequency density) of ${density}. What is the frequency?`;
    const distractors = uniqueNumericDistractors(frequency, [width, density, width + density, density * 2], rng).map(
      (v) => fmtNumber(v)
    ) as [string, string, string];
    const note = distractors.includes(fmtNumber(width)) ? ` The option ${width} stops at the class width.` : '';
    return {
      stem,
      correct: fmtNumber(frequency),
      distractors,
      explanation: `Frequency = frequency density × class width = $${density} \\times ${width} = ${frequency}$.${note}`,
    };
  }

  const stem = `A class has frequency ${frequency} and frequency density ${density}. What is its class width?`;
  const distractors = uniqueNumericDistractors(width, [frequency, density, frequency * density, width + 1], rng).map(
    (v) => fmtNumber(v)
  ) as [string, string, string];
  const note = distractors.includes(fmtNumber(frequency * density))
    ? ` The option ${frequency * density} multiplies instead of dividing.`
    : '';
  return {
    stem,
    correct: fmtNumber(width),
    distractors,
    explanation: `Class width = frequency ÷ frequency density = $${frequency} \\div ${density} = ${width}$.${note}`,
  };
}

export const mathFrequencyDensity: QuestionGenerator<FrequencyDensityParams> = {
  id: 'math-frequency-density',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
