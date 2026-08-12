import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Half-life calculations: remaining mass after n half-lives, and the inverse
// (time elapsed from the mass that remains). Masses are in grams.

const isotopeSchema = z.object({
  name: z.string().min(1),
  halfLife: z.number().positive(),
  unit: z.enum(['minutes', 'hours', 'days', 'years']),
  startMass: z.number().positive(),
});

export const paramsSchema = z.object({
  isotopes: z.array(isotopeSchema).min(1),
  /** Candidate numbers of half-lives elapsed (n). */
  halfLives: z.array(z.number().int().min(1)).min(1),
  modes: z.array(z.enum(['remaining', 'elapsed'])).optional(),
});
export type HalfLifeParams = z.infer<typeof paramsSchema>;

type Unit = 'minutes' | 'hours' | 'days' | 'years';

export interface HalfLifeValues {
  mode: 'remaining' | 'elapsed';
  name: string;
  halfLife: number;
  unit: Unit;
  startMass: number;
  n: number;
}

export function draw(params: HalfLifeParams, rng: Rng): HalfLifeValues {
  const mode = pick(params.modes ?? ['remaining' as const, 'elapsed' as const], rng);
  const isotope = pick(params.isotopes, rng);
  const n = pick(params.halfLives, rng);
  return { mode, ...isotope, n };
}

function withUnit(value: number, unit: Unit): string {
  const singular = unit.slice(0, -1);
  return `${fmtNumber(value)} ${value === 1 ? singular : unit}`;
}

export function build(values: HalfLifeValues, rng: Rng): GeneratorOutput {
  const { mode, name, halfLife, unit, startMass, n } = values;
  const remaining = startMass / 2 ** n;
  const elapsed = n * halfLife;

  if (mode === 'remaining') {
    // Error rules: linear decay (start - n*start/2, only if still positive),
    // start/n, and one half-life too few or too many.
    const linear = startMass - n * (startMass / 2);
    const candidates = [
      ...(linear > 0 ? [linear] : []),
      startMass / n,
      startMass / 2 ** (n - 1),
      startMass / 2 ** (n + 1),
    ];
    const distractorValues = uniqueNumericDistractors(remaining, candidates, rng);
    return {
      stem: `${capitalise(name)} has a half-life of ${withUnit(halfLife, unit)}. A sample starts with ${fmtNumber(startMass)} g. What mass remains after ${withUnit(elapsed, unit)}?`,
      correct: `${fmtNumber(remaining)} g`,
      distractors: distractorValues.map((d) => `${fmtNumber(d)} g`) as [string, string, string],
      explanation: String.raw`Number of half-lives: $${fmtNumber(elapsed)}\div${fmtNumber(halfLife)}=${n}$. The mass halves each time: $${fmtNumber(startMass)}\times\left(\dfrac{1}{2}\right)^{${n}}=${fmtNumber(remaining)}\text{ g}$. Subtracting a fixed amount each half-life (linear decay) is the classic trap.`,
    };
  }

  // elapsed mode (inverse): given the remaining mass, find the time.
  // Error rules: one half-life too few/many, the half-life count alone (not
  // multiplied by the half-life), and the mass lost read off as the time.
  const candidates = [(n - 1) * halfLife, (n + 1) * halfLife, n, startMass - remaining];
  const distractorValues = uniqueNumericDistractors(elapsed, candidates, rng);
  const units = distractorValues.map((d) => withUnit(d, unit)) as [string, string, string];
  return {
    stem: `${capitalise(name)} has a half-life of ${withUnit(halfLife, unit)}. A ${fmtNumber(startMass)} g sample decays until ${fmtNumber(remaining)} g remains. How much time has passed?`,
    correct: withUnit(elapsed, unit),
    distractors: units,
    explanation: String.raw`Count the halvings: ${fmtNumber(startMass)} g down to ${fmtNumber(remaining)} g is $n=\log_2\left(\dfrac{${fmtNumber(startMass)}}{${fmtNumber(remaining)}}\right)=${n}$ half-lives. Then time $=${n}\times${fmtNumber(halfLife)}=${fmtNumber(elapsed)}$ ${unit}.`,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const chemHalfLife: QuestionGenerator<HalfLifeParams> = {
  id: 'chem-half-life',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
