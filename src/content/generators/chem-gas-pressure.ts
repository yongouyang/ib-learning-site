import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Boyle's law for a fixed mass of gas at constant temperature: p1*V1 = p2*V2. Both
// directions (find the new pressure, find the new volume) are CONSTRUCTED from
// exact divisions: a triple is drawn only when the unknown is a whole number, so no
// answer can be a repeating decimal.
//
// Distractors are the named errors: the ratio applied the wrong way up (treating an
// inverse proportion as a direct one), the pressure left unchanged, and the doubled
// or halved answer.

const MODES = ['pressure', 'volume'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Pressures in kPa. */
  pressures: z.array(z.number().int().min(50).max(500)).min(2),
  /** Volumes in cm^3. */
  volumes: z.array(z.number().int().min(10).max(200)).min(2),
});
export type GasPressureParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface GasPressureValues {
  mode: Mode;
  p1: number;
  v1: number;
  /** The second pressure (volume mode) or the computed new pressure (pressure mode). */
  p2: number;
  /** The second volume (pressure mode) or the computed new volume (volume mode). */
  v2: number;
}

export function draw(params: GasPressureParams, rng: Rng): GasPressureValues {
  const modes = params.modes ?? [...MODES];

  const pressureCases: [number, number, number][] = [];
  for (const p1 of params.pressures) {
    for (const v1 of params.volumes) {
      for (const v2 of params.volumes) {
        if (v1 !== v2 && (p1 * v1) % v2 === 0) pressureCases.push([p1, v1, v2]);
      }
    }
  }
  const volumeCases: [number, number, number][] = [];
  for (const p1 of params.pressures) {
    for (const v1 of params.volumes) {
      for (const p2 of params.pressures) {
        if (p1 !== p2 && (p1 * v1) % p2 === 0) volumeCases.push([p1, v1, p2]);
      }
    }
  }

  const feasible = modes.filter((mode) => (mode === 'pressure' ? pressureCases.length > 0 : volumeCases.length > 0));
  if (feasible.length === 0) {
    throw new Error('chem-gas-pressure: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'pressure') {
    const [p1, v1, v2] = pick(pressureCases, rng);
    return { mode, p1, v1, v2, p2: (p1 * v1) / v2 };
  }
  const [p1, v1, p2] = pick(volumeCases, rng);
  return { mode, p1, v1, p2, v2: (p1 * v1) / p2 };
}

export function build(values: GasPressureValues, rng: Rng): GeneratorOutput {
  const { mode, p1, v1, p2, v2 } = values;

  if (mode === 'pressure') {
    const correct = `$${fmtNumber(p2)}$ kPa`;
    const wrongWay = cleanNumbers([(p1 * v2) / v1]);
    const candidates = [...wrongWay, p1, p2 * 2, p2 / 2];
    const distractors = uniqueNumericDistractors(p2, cleanNumbers(candidates), rng).map(
      (v) => `$${fmtNumber(v)}$ kPa`
    ) as [string, string, string];
    const squeezed = v2 < v1;
    const wrongWayNote =
      wrongWay.length > 0
        ? ` The ratio the wrong way up gives $${fmtNumber(wrongWay[0])}$ kPa instead.`
        : '';
    return {
      stem: `A sealed syringe contains $${v1}$ cm³ of gas at a pressure of $${p1}$ kPa. The gas is ${
        squeezed ? 'compressed' : 'allowed to expand'
      } to $${v2}$ cm³ at constant temperature. What is the new pressure?`,
      correct,
      distractors,
      explanation: `At constant temperature $p_1V_1 = p_2V_2$, so $p_2 = \\dfrac{p_1V_1}{V_2} = \\dfrac{${p1} \\times ${v1}}{${v2}} = ${fmtNumber(
        p2
      )}$ kPa. The volume ${squeezed ? 'fell' : 'rose'}, so the pressure must ${squeezed ? 'rise' : 'fall'}.${wrongWayNote}`,
    };
  }

  const correct = `$${fmtNumber(v2)}$ cm³`;
  const wrongWay = cleanNumbers([(v1 * p2) / p1]);
  const candidates = [...wrongWay, v1, v2 * 2, v2 / 2];
  const distractors = uniqueNumericDistractors(v2, cleanNumbers(candidates), rng).map(
    (v) => `$${fmtNumber(v)}$ cm³`
  ) as [string, string, string];
  const squeezed = p2 > p1;
  return {
    stem: `A sealed syringe contains $${v1}$ cm³ of gas at a pressure of $${p1}$ kPa. At constant temperature the pressure ${
      squeezed ? 'rises' : 'falls'
    } to $${p2}$ kPa. What is the new volume?`,
    correct,
    distractors,
    explanation: `At constant temperature $p_1V_1 = p_2V_2$, so $V_2 = \\dfrac{p_1V_1}{p_2} = \\dfrac{${p1} \\times ${v1}}{${p2}} = ${fmtNumber(
      v2
    )}$ cm³. The pressure ${squeezed ? 'rose' : 'fell'}, so the volume must ${squeezed ? 'fall' : 'rise'} — the ratio the wrong way up moves it the other way.`,
  };
}

export const chemGasPressure: QuestionGenerator<GasPressureParams> = {
  id: 'chem-gas-pressure',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
