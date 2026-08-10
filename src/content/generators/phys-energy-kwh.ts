import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Electrical energy in kilowatt-hours: E = P*t with P converted W -> kW.
// The W -> kW conversion is the trap.

export const paramsSchema = z.object({
  watts: z.array(z.number().positive()).min(1),
  hours: z.array(z.number().positive()).min(1),
});
export type EnergyKwhParams = z.infer<typeof paramsSchema>;

export interface EnergyKwhValues {
  watts: number;
  hours: number;
  kw: number;
  energy: number; // kWh
}

export function draw(params: EnergyKwhParams, rng: Rng): EnergyKwhValues {
  const watts = pick(params.watts, rng);
  const hours = pick(params.hours, rng);
  const kw = watts / 1000;
  return { watts, hours, kw, energy: kw * hours };
}

export function build(values: EnergyKwhValues, rng: Rng): GeneratorOutput {
  const { watts, hours, kw, energy } = values;
  // Error rules: watts×hours (no W->kW conversion), kW alone (power, not
  // energy), and watts/hours (dividing).
  const distractorValues = uniqueNumericDistractors(
    energy,
    [watts * hours, kw, watts / hours].filter((n) => n > 0),
    rng
  );
  return {
    stem: `A ${fmtNumber(watts)} W appliance runs for ${fmtNumber(hours)} ${hours === 1 ? 'hour' : 'hours'}. How much energy does it use in kilowatt-hours?`,
    correct: `${fmtNumber(energy)} kWh`,
    distractors: distractorValues.map((d) => `${fmtNumber(d)} kWh`) as [string, string, string],
    explanation: String.raw`Convert watts to kilowatts first: ${fmtNumber(watts)} W = ${fmtNumber(kw)} kW. Then $E=Pt=${fmtNumber(kw)}\times${fmtNumber(hours)}=${fmtNumber(energy)}\text{ kWh}$. Using ${fmtNumber(watts)} directly gives the ${fmtNumber(watts * hours)} kWh trap.`,
  };
}

export const physEnergyKwh: QuestionGenerator<EnergyKwhParams> = {
  id: 'phys-energy-kwh',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
