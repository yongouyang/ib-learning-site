import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Thermal energy: the specific heat capacity equation E = m c delta-theta and the
// latent heat equation E = m L. The energy is always CONSTRUCTED as the product
// that the question is about, so a question asking for the mass or the temperature
// change is the exact inverse of a whole-number energy.
//
// Distractors are the named errors: dropping one of the three factors on the way
// to the energy (using the temperature rather than the temperature CHANGE, or the
// mass alone), dividing where the formula multiplies, and a factor of ten.

const MODES = ['shc-energy', 'shc-mass', 'shc-temp-change', 'latent-energy', 'latent-mass'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Masses in kg. */
  masses: z.array(z.number().positive()).min(1),
  /** Specific heat capacities in J/kg°C. */
  shcs: z.array(z.number().positive()).min(1),
  /** Temperature changes in °C. */
  deltas: z.array(z.number().positive()).min(1),
  /** Specific latent heats in J/kg. */
  latents: z.array(z.number().positive()).min(1),
});
export type ThermalEnergyParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface ThermalEnergyValues {
  mode: Mode;
  mass: number;
  c: number;
  delta: number;
  latent: number;
  answer: number;
}

export function draw(params: ThermalEnergyParams, rng: Rng): ThermalEnergyValues {
  const mode = pick(params.modes ?? [...MODES], rng);
  const mass = pick(params.masses, rng);
  const c = pick(params.shcs, rng);
  const delta = pick(params.deltas, rng);
  const latent = pick(params.latents, rng);
  const energy = mode.startsWith('latent') ? mass * latent : mass * c * delta;
  const answer =
    mode === 'shc-energy' || mode === 'latent-energy'
      ? energy
      : mode === 'shc-mass'
        ? mass
        : mode === 'shc-temp-change'
          ? delta
          : energy / latent;
  return { mode, mass, c, delta, latent, answer };
}

const joules = (v: number) => `${fmtNumber(v)} J`;
const kg = (v: number) => `${fmtNumber(v)} kg`;
const degrees = (v: number) => `${fmtNumber(v)}°C`;

export function build(values: ThermalEnergyValues, rng: Rng): GeneratorOutput {
  const { mode, mass, c, delta, latent, answer } = values;
  const energy = mode.startsWith('latent') ? mass * latent : mass * c * delta;

  if (mode === 'shc-energy') {
    const stem = `How much energy is needed to heat ${kg(mass)} of a substance of specific heat capacity ${c} J/kg°C by ${degrees(delta)}?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([mass * delta, c * delta, answer * 10, answer / 10]), rng).map(
      joules
    ) as [string, string, string];
    const note = distractors.includes(joules(mass * delta))
      ? ` The ${joules(mass * delta)} option leaves out the specific heat capacity.`
      : '';
    return {
      stem,
      correct: joules(answer),
      distractors,
      explanation: `Energy $= mc\\Delta\\theta = ${fmtNumber(mass)} \\times ${fmtNumber(c)} \\times ${fmtNumber(delta)} = ${fmtNumber(answer)}\\text{ J}$.${note}`,
    };
  }

  if (mode === 'shc-mass') {
    const stem = `A substance of specific heat capacity ${c} J/kg°C needs ${joules(energy)} to warm it by ${degrees(delta)}. What mass is being heated?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([energy / delta, energy / c, answer * 2, answer / 2]), rng).map(
      kg
    ) as [string, string, string];
    return {
      stem,
      correct: kg(answer),
      distractors,
      explanation: `Rearranged, mass $= \\dfrac{E}{c\\Delta\\theta} = \\dfrac{${fmtNumber(energy)}}{${fmtNumber(c)} \\times ${fmtNumber(delta)}} = ${fmtNumber(answer)}\\text{ kg}$.`,
    };
  }

  if (mode === 'shc-temp-change') {
    const stem = `A ${kg(mass)} block of specific heat capacity ${c} J/kg°C absorbs ${joules(energy)}. By how much does its temperature rise?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([energy / mass, energy / c, answer + 10, answer * 2]), rng).map(
      degrees
    ) as [string, string, string];
    const note = distractors.includes(degrees(energy / mass)) ? ` The ${degrees(energy / mass)} option divides by the mass alone.` : '';
    return {
      stem,
      correct: degrees(answer),
      distractors,
      explanation: `Rearranged, $\\Delta\\theta = \\dfrac{E}{mc} = \\dfrac{${fmtNumber(energy)}}{${fmtNumber(mass)} \\times ${fmtNumber(c)}} = ${fmtNumber(answer)}\\text{°C}$.${note}`,
    };
  }

  if (mode === 'latent-energy') {
    const stem = `How much energy is needed to melt ${kg(mass)} of a substance with a specific latent heat of fusion of ${latent} J/kg?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([mass, latent, answer * 10, answer / 10]), rng).map(joules) as [
      string,
      string,
      string,
    ];
    const note = distractors.includes(joules(mass))
      ? ` The ${joules(mass)} option uses the mass alone — latent heat is per kilogram.`
      : '';
    return {
      stem,
      correct: joules(answer),
      distractors,
      explanation: `Energy $= mL = ${fmtNumber(mass)} \\times ${fmtNumber(latent)} = ${fmtNumber(answer)}\\text{ J}$.${note}`,
    };
  }

  const stem = `Changing the state of a substance with a specific latent heat of ${latent} J/kg needs ${joules(energy)}. What mass changes state?`;
  const distractors = uniqueNumericDistractors(answer, cleanNumbers([energy * latent, energy / (2 * latent), answer * 10, answer / 10]), rng).map(
    kg
  ) as [string, string, string];
  const note = distractors.includes(kg(energy / (2 * latent))) ? ` The ${kg(energy / (2 * latent))} option halves the mass for no reason.` : '';
  return {
    stem,
    correct: kg(answer),
    distractors,
    explanation: `Rearranged, mass $= \\dfrac{E}{L} = \\dfrac{${fmtNumber(energy)}}{${fmtNumber(latent)}} = ${fmtNumber(answer)}\\text{ kg}$.${note}`,
  };
}

export const physThermalEnergy: QuestionGenerator<ThermalEnergyParams> = {
  id: 'phys-thermal-energy',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
