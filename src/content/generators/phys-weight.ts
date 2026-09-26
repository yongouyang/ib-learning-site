import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Weight on different bodies: W = m g. The bodies table pairs each body with its
// gravitational field strength (Earth 10, the Moon 1.6, Mars 3.7, Jupiter 25 N/kg),
// and every product m*g of a short decimal with an integer mass prints cleanly, so
// no answer can be a repeating decimal. Modes: find the weight, find the mass from
// the weight, and a trip question (mass and weight after travelling to another
// body) that drills the mass-vs-weight distinction head-on.
//
// Distractors are the named errors: quoting the mass as the weight (and vice
// versa), dividing where the formula multiplies, and using Earth's g on another
// body.

const MODES = ['weight', 'mass', 'trip'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Bodies and their gravitational field strengths in N/kg. */
  bodies: z.array(z.object({ body: z.string().min(3), g: z.number().min(1).max(30) })).min(2),
  /** Masses in kg. */
  masses: z.array(z.number().int().min(1).max(100)).min(1),
});
export type WeightParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface WeightValues {
  mode: Mode;
  bodyA: string;
  gA: number;
  bodyB: string;
  gB: number;
  m: number;
  /** m * gB — the weight on body B. */
  wB: number;
}

export function draw(params: WeightParams, rng: Rng): WeightValues {
  const modes = params.modes ?? [...MODES];
  const feasible = modes.filter((mode) => {
    if (mode === 'trip') return params.bodies.length >= 2;
    return params.bodies.length > 0 && params.masses.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('phys-weight: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  const first = pick(params.bodies, rng);
  const rest = params.bodies.filter((b) => b.body !== first.body);
  const second = rest.length > 0 ? pick(rest, rng) : first;
  const m = pick(params.masses, rng);
  // The trip asks about body B; the single-body modes use B alone.
  return { mode, bodyA: first.body, gA: first.g, bodyB: second.body, gB: second.g, m, wB: m * second.g };
}

export function build(values: WeightValues, rng: Rng): GeneratorOutput {
  const { mode, bodyA, gA, bodyB, gB, m, wB } = values;

  if (mode === 'weight') {
    const correct = `$${fmtNumber(wB)}$ N`;
    const distractors = uniqueNumericDistractors(
      wB,
      cleanNumbers([m, m + gB, m * 10, m / gB]),
      rng
    ).map((v) => `$${fmtNumber(v)}$ N`) as [string, string, string];
    return {
      stem: `The gravitational field strength on ${bodyB} is $${fmtNumber(gB)}$ N/kg. What is the weight of a $${m}$ kg object there?`,
      correct,
      distractors,
      explanation: `$W = mg = ${m} \\times ${fmtNumber(gB)} = ${fmtNumber(wB)}$ N. The $${m}$ N option is the mass, not the weight — mass stays in kilograms.`,
    };
  }

  if (mode === 'mass') {
    const correct = `$${m}$ kg`;
    const distractors = uniqueNumericDistractors(
      m,
      cleanNumbers([wB, wB * gB, wB / 10, m + gB]),
      rng
    ).map((v) => `$${fmtNumber(v)}$ kg`) as [string, string, string];
    return {
      stem: `An object weighs $${fmtNumber(wB)}$ N on ${bodyB}, where the gravitational field strength is $${fmtNumber(gB)}$ N/kg. What is its mass?`,
      correct,
      distractors,
      explanation: `$m = \\dfrac{W}{g} = \\dfrac{${fmtNumber(wB)}}{${fmtNumber(gB)}} = ${m}$ kg. The $${fmtNumber(
        wB
      )}$ kg option quotes the weight as the mass — they are different quantities with different units.`,
    };
  }

  const wA = m * gA;
  const correct = `Mass $${m}$ kg, weight $${fmtNumber(wB)}$ N`;
  const candidates = [
    // Weight unchanged by the move.
    `Mass $${m}$ kg, weight $${fmtNumber(wA)}$ N`,
    // The weight value mistaken for the new mass.
    `Mass $${fmtNumber(wB)}$ kg, weight $${fmtNumber(wB)}$ N`,
    // Weight equal to the mass (g forgotten).
    `Mass $${m}$ kg, weight $${m}$ N`,
  ];
  const pool = [
    `Mass $${fmtNumber(wA)}$ kg, weight $${fmtNumber(wB)}$ N`,
    `Mass $${m}$ kg, weight $${fmtNumber(wB + gB)}$ N`,
    `Mass $${m + 1}$ kg, weight $${fmtNumber(wB)}$ N`,
  ];
  return {
    stem: `An astronaut has a mass of $${m}$ kg on ${bodyA}, where $g = ${fmtNumber(gA)}$ N/kg. She travels to ${bodyB}, where $g = ${fmtNumber(
      gB
    )}$ N/kg. What are her mass and weight on ${bodyB}?`,
    correct,
    distractors: uniqueDistractors(correct, candidates, pool, rng),
    explanation: `Mass does not change with location — it stays $${m}$ kg. Weight does: $W = mg = ${m} \\times ${fmtNumber(gB)} = ${fmtNumber(
      wB
    )}$ N on ${bodyB}, compared with $${fmtNumber(wA)}$ N on ${bodyA}.`,
  };
}

export const physWeight: QuestionGenerator<WeightParams> = {
  id: 'phys-weight',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
