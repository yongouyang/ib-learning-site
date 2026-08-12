import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, toSuperscript, uniqueNumericDistractors } from './utils';

// Relative atomic mass from two isotopes: weighted mean of the mass numbers,
// rounded to 1 decimal place. Choices are plain numbers (house style: "35.5").

const pairSchema = z
  .object({
    element: z.string().min(1),
    symbol: z.string().min(1),
    massA: z.number().int().positive(),
    massB: z.number().int().positive(),
    /** Percentage abundance of isotope A; isotope B makes up the rest. */
    abundanceA: z.number().gt(0).lt(100),
  })
  .refine((p) => p.massA !== p.massB, { message: 'massA and massB must differ' });

export const paramsSchema = z.object({
  pairs: z.array(pairSchema).min(1),
});
export type IsotopeRamParams = z.infer<typeof paramsSchema>;

export interface IsotopeRamValues {
  element: string;
  symbol: string;
  massA: number;
  massB: number;
  abundanceA: number;
  abundanceB: number;
}

export function draw(params: IsotopeRamParams, rng: Rng): IsotopeRamValues {
  const pair = pick(params.pairs, rng);
  return { ...pair, abundanceB: 100 - pair.abundanceA };
}

/** Weighted mean of the two mass numbers, rounded to 1 dp. */
export function ramOf(values: IsotopeRamValues): number {
  const raw = (values.abundanceA * values.massA + values.abundanceB * values.massB) / 100;
  return Math.round(raw * 10) / 10;
}

export function build(values: IsotopeRamValues, rng: Rng): GeneratorOutput {
  const { element, symbol, massA, massB, abundanceA, abundanceB } = values;
  const ram = ramOf(values);
  const raw = (abundanceA * massA + abundanceB * massB) / 100;
  // Error rules: unweighted mean, swapped weights, each mass number alone, and
  // rounding to a whole number.
  const swapped = Math.round(((abundanceA * massB + abundanceB * massA) / 100) * 10) / 10;
  const distractorValues = uniqueNumericDistractors(
    ram,
    [(massA + massB) / 2, swapped, massA, massB, Math.round(raw)],
    rng
  );
  return {
    stem: `${capitalise(element)} has two isotopes: ${fmtNumber(abundanceA)}% ${toSuperscript(massA)}${symbol} and ${fmtNumber(abundanceB)}% ${toSuperscript(massB)}${symbol}. What is its relative atomic mass?`,
    correct: fmtNumber(ram),
    distractors: distractorValues.map((d) => fmtNumber(d)) as [string, string, string],
    explanation: String.raw`Weight each mass number by its abundance: $A_r=\dfrac{${fmtNumber(abundanceA)}\times${massA}+${fmtNumber(abundanceB)}\times${massB}}{100}=\dfrac{${fmtNumber(abundanceA * massA + abundanceB * massB)}}{100}=${fmtNumber(ram)}$. The unweighted mean ${fmtNumber((massA + massB) / 2)} ignores the abundances.`,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const chemIsotopeRam: QuestionGenerator<IsotopeRamParams> = {
  id: 'chem-isotope-ram',
  difficulty: 'hard',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
