import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Density: rho = m / V, asked for the density, the mass or the volume. The mass is
// built as density x volume, so every answer is exact, and the density mode only
// draws mass/volume pairs that divide cleanly.
//
// Distractors are the named errors: inverting the formula (V/m), multiplying mass
// by volume, and slipping a factor of ten — the last is the one that decides
// whether a block floats, so it is worth offering.

const MODES = ['density', 'mass', 'volume'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Masses in g. */
  masses: z.array(z.number().positive()).min(1),
  /** Volumes in cm^3. */
  volumes: z.array(z.number().positive()).min(1),
  /** Densities in g/cm^3, used as the "given" value in the mass and volume modes. */
  densities: z.array(z.number().positive()).min(1),
});
export type DensityParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface DensityValues {
  mode: Mode;
  mass: number;
  volume: number;
  density: number;
  answer: number;
}

const clean = (n: number, dp = 3) => Number.isFinite(n) && Math.abs(n * 10 ** dp - Math.round(n * 10 ** dp)) < 1e-9;

export function draw(params: DensityParams, rng: Rng): DensityValues {
  const modes = params.modes ?? [...MODES];
  const feasible = modes.filter((m) => {
    if (m === 'density') return params.masses.some((v) => params.volumes.some((V) => clean(v / V)));
    // The volume mode divides by the density, so only pairs that terminate are
    // drawn: 200 / 2.7 is 74.074074..., which is not an answer to print.
    if (m === 'volume') return params.masses.some((mass) => params.densities.some((d) => clean(mass / d)));
    return params.densities.length > 0 && params.volumes.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('phys-density: no mode is feasible for this param table — add masses, volumes and densities');
  }
  const mode = pick(feasible, rng);

  if (mode === 'density') {
    const pairs: [number, number][] = [];
    for (const mass of params.masses) for (const volume of params.volumes) if (clean(mass / volume)) pairs.push([mass, volume]);
    const [mass, volume] = pick(pairs, rng);
    return { mode, mass, volume, density: mass / volume, answer: mass / volume };
  }
  if (mode === 'mass') {
    const density = pick(params.densities, rng);
    const volume = pick(params.volumes, rng);
    return { mode, mass: density * volume, volume, density, answer: density * volume };
  }
  const volumePairs: [number, number][] = [];
  for (const mass of params.masses) {
    for (const d of params.densities) if (clean(mass / d)) volumePairs.push([mass, d]);
  }
  if (volumePairs.length === 0) {
    throw new Error('phys-density: no mass/density pair gives a whole-number volume — add masses and densities');
  }
  const [volumeMass, volumeDensity] = pick(volumePairs, rng);
  return { mode, mass: volumeMass, volume: volumeMass / volumeDensity, density: volumeDensity, answer: volumeMass / volumeDensity };
}

const grams = (v: number) => `${fmtNumber(v)} g`;
const cubicCm = (v: number) => `${fmtNumber(v)} cm³`;
const perCubicCm = (v: number) => `${fmtNumber(v)} g/cm³`;

export function build(values: DensityValues, rng: Rng): GeneratorOutput {
  const { mode, mass, volume, density, answer } = values;

  if (mode === 'density') {
    const stem = `An object has a mass of ${grams(mass)} and a volume of ${cubicCm(volume)}. What is its density?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([volume / mass, mass * volume, answer * 10, answer / 10]), rng).map(
      (v) => perCubicCm(v)
    ) as [string, string, string];
    const note = distractors.includes(perCubicCm(mass * volume))
      ? ` The ${perCubicCm(mass * volume)} option multiplies instead of dividing.`
      : '';
    return {
      stem,
      correct: perCubicCm(answer),
      distractors,
      explanation: `Density $= \\dfrac{\\text{mass}}{\\text{volume}} = \\dfrac{${fmtNumber(mass)}\\text{ g}}{${fmtNumber(volume)}\\text{ cm}^3} = ${fmtNumber(answer)}\\text{ g/cm}^3$.${note}`,
    };
  }

  if (mode === 'mass') {
    const stem = `A block of material with a density of ${perCubicCm(density)} has a volume of ${cubicCm(volume)}. What is its mass?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([density / volume, density + volume, answer * 10, answer / 10]), rng).map(
      (v) => grams(v)
    ) as [string, string, string];
    const note = distractors.includes(grams(density / volume)) ? ` The ${grams(density / volume)} option divides instead of multiplying.` : '';
    return {
      stem,
      correct: grams(answer),
      distractors,
      explanation: `Rearranged, mass $=$ density $\\times$ volume $= ${fmtNumber(density)} \\times ${fmtNumber(volume)} = ${fmtNumber(answer)}\\text{ g}$.${note}`,
    };
  }

  const stem = `An object with a mass of ${grams(mass)} is made of a material with a density of ${perCubicCm(density)}. What is its volume?`;
  const distractors = uniqueNumericDistractors(answer, cleanNumbers([mass * density, density / mass, answer * 10, answer / 10]), rng).map(
    (v) => cubicCm(v)
  ) as [string, string, string];
  const note = distractors.includes(cubicCm(mass * density)) ? ` The ${cubicCm(mass * density)} option multiplies instead of dividing.` : '';
  return {
    stem,
    correct: cubicCm(answer),
    distractors,
    explanation: `Rearranged, volume $= \\dfrac{\\text{mass}}{\\text{density}} = \\dfrac{${fmtNumber(mass)}\\text{ g}}{${fmtNumber(density)}\\text{ g/cm}^3} = ${fmtNumber(answer)}\\text{ cm}^3$.${note}`,
  };
}

export const physDensity: QuestionGenerator<DensityParams> = {
  id: 'phys-density',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
