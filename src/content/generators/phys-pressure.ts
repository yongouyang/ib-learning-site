import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Pressure and moments: P = F / A (asked for each of the three quantities), the
// moment of a force M = F x d, the hydraulic multiplier F1/A1 = F2/A2, and the
// balance of a lever m1 d1 = m2 d2.
//
// Every instance is CONSTRUCTED from the answer backwards (the pressure is drawn
// and the force computed as P x A), so no draw can produce an awkward quotient.
// Modes whose numbers do not come out clean for the params table are dropped
// instead of throwing, so an unlucky session seed cannot break the page.
//
// Distractors are the named errors: multiplying where the formula divides (and
// vice versa), inverting the ratio, and forgetting that a moment needs the
// perpendicular distance.

const MODES = ['pressure', 'force', 'area', 'moment', 'hydraulic', 'lever'] as const;

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Forces in N (and, for the lever mode, masses in kg). */
    forces: z.array(z.number().positive()).min(1),
    /** Areas in m^2. */
    areas: z.array(z.number().positive()).min(1),
    /** Distances in m. */
    distances: z.array(z.number().positive()).min(1),
  })
  .refine((p) => p.areas.every((a) => Math.abs(a * 100 - Math.round(a * 100)) < 1e-9), {
    message: 'phys-pressure: areas must be exact to at most 2 decimal places, or the answers stop being clean',
  });
export type PressureParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface PressureValues {
  mode: Mode;
  f: number;
  a: number;
  /** Second area (hydraulic) or second mass (lever). */
  b: number;
  d: number;
  answer: number;
}

const clean = (n: number, dp = 3) => Number.isFinite(n) && Math.abs(n * 10 ** dp - Math.round(n * 10 ** dp)) < 1e-9;

export function draw(params: PressureParams, rng: Rng): PressureValues {
  // Normalise the schema defaults here too (plain objects reach draw() in tests).
  const modes = params.modes ?? [...MODES];

  // Only modes this param table can answer exactly are drawn.
  const feasible = modes.filter((m) => {
    if (m === 'pressure') return params.forces.some((f) => params.areas.some((a) => clean(f / a)));
    if (m === 'force' || m === 'area') return params.forces.length > 0 && params.areas.length > 0;
    if (m === 'moment') return params.forces.length > 0 && params.distances.length > 0;
    if (m === 'hydraulic') {
      return params.areas.some((a1) =>
        params.areas.some((a2) => a1 !== a2 && params.forces.some((f) => clean((f * a2) / a1)))
      );
    }
    // lever: m1 d1 = m2 d2 with a whole d2
    return params.forces.some((m1) =>
      params.distances.some((d1) => params.forces.some((m2) => (m1 * d1) % m2 === 0 && (m1 * d1) / m2 > 0))
    );
  });
  if (feasible.length === 0) {
    throw new Error('phys-pressure: no mode is feasible for this param table — add forces/areas/distances');
  }
  const mode = pick(feasible, rng);

  if (mode === 'pressure') {
    const pairs: [number, number][] = [];
    for (const f of params.forces) for (const a of params.areas) if (clean(f / a)) pairs.push([f, a]);
    const [f, a] = pick(pairs, rng);
    return { mode, f, a, b: 0, d: 0, answer: f / a };
  }
  if (mode === 'force') {
    // Constructed from a pressure x area, so the answer is exact by definition.
    const p = pick(params.forces, rng);
    const a = pick(params.areas, rng);
    return { mode, f: p, a, b: 0, d: 0, answer: p * a };
  }
  if (mode === 'area') {
    const p = pick(params.forces, rng);
    const a = pick(params.areas, rng);
    return { mode, f: p * a, a: p, b: 0, d: 0, answer: a };
  }
  if (mode === 'moment') {
    const f = pick(params.forces, rng);
    const d = pick(params.distances, rng);
    return { mode, f, a: 0, b: 0, d, answer: f * d };
  }
  if (mode === 'hydraulic') {
    const candidates: [number, number, number][] = [];
    for (const a1 of params.areas)
      for (const a2 of params.areas)
        for (const f of params.forces) if (a1 !== a2 && clean((f * a2) / a1)) candidates.push([f, a1, a2]);
    const [f, a1, a2] = pick(candidates, rng);
    return { mode, f, a: a1, b: a2, d: 0, answer: (f * a2) / a1 };
  }
  const candidates: [number, number, number][] = [];
  for (const m1 of params.forces)
    for (const d1 of params.distances)
      for (const m2 of params.forces) {
        if ((m1 * d1) % m2 === 0 && m1 !== m2) candidates.push([m1, d1, m2]);
      }
  const [m1, d1, m2] = pick(candidates, rng);
  return { mode, f: m1, a: 0, b: m2, d: d1, answer: (m1 * d1) / m2 };
}

function force(value: number): string {
  return `${fmtNumber(value)} N`;
}
function area(value: number): string {
  return `${fmtNumber(value)} m²`;
}
function pressure(value: number): string {
  return `${fmtNumber(value)} Pa`;
}
function newtonMetre(value: number): string {
  return `${fmtNumber(value)} Nm`;
}

export function build(values: PressureValues, rng: Rng): GeneratorOutput {
  const { mode, f, a, b, d, answer } = values;

  if (mode === 'pressure') {
    const stem = `A force of ${force(f)} acts on an area of ${area(a)}. What is the pressure?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([f * a, a / f, answer * 10, answer / 10]), rng).map(
      (v) => pressure(v)
    ) as [string, string, string];
    const note = distractors.includes(pressure(f * a)) ? ` The ${pressure(f * a)} option multiplies instead of dividing.` : '';
    return {
      stem,
      correct: pressure(answer),
      distractors,
      explanation: `Pressure $= \\dfrac{F}{A} = \\dfrac{${fmtNumber(f)}\\text{ N}}{${fmtNumber(a)}\\text{ m}^2} = ${fmtNumber(answer)}\\text{ Pa}$.${note}`,
    };
  }

  if (mode === 'force') {
    const stem = `A pressure of ${pressure(f)} acts on an area of ${area(a)}. What is the force?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([f / a, f + a, f * a * 2, answer / 2]), rng).map((v) =>
      force(v)
    ) as [string, string, string];
    const note = distractors.includes(force(f / a)) ? ` The ${force(f / a)} option divides instead of multiplying.` : '';
    return {
      stem,
      correct: force(answer),
      distractors,
      explanation: `Rearranged, force $=$ pressure $\\times$ area $= ${fmtNumber(f)} \\times ${fmtNumber(a)} = ${fmtNumber(answer)}\\text{ N}$.${note}`,
    };
  }

  if (mode === 'area') {
    const stem = `A force of ${force(f)} produces a pressure of ${pressure(a)}. What is the area it acts on?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([f * a, a / f, answer + a, answer * 2]), rng).map((v) =>
      area(v)
    ) as [string, string, string];
    const note = distractors.includes(area(f * a)) ? ` The ${area(f * a)} option multiplies instead of dividing.` : '';
    return {
      stem,
      correct: area(answer),
      distractors,
      explanation: `Rearranged, area $= \\dfrac{F}{P} = \\dfrac{${fmtNumber(f)}\\text{ N}}{${fmtNumber(a)}\\text{ Pa}} = ${fmtNumber(answer)}\\text{ m}^2$.${note}`,
    };
  }

  if (mode === 'moment') {
    const stem = `A force of ${force(f)} acts at a perpendicular distance of ${fmtNumber(d)} m from a pivot. What is the moment of the force?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([f / d, f + d, f * d * 2, answer / 2]), rng).map(
      (v) => newtonMetre(v)
    ) as [string, string, string];
    const note = distractors.includes(newtonMetre(f + d)) ? ` The ${newtonMetre(f + d)} option adds instead of multiplying.` : '';
    return {
      stem,
      correct: newtonMetre(answer),
      distractors,
      explanation: `Moment $= Fd = ${fmtNumber(f)} \\times ${fmtNumber(d)} = ${fmtNumber(answer)}\\text{ Nm}$.${note}`,
    };
  }

  if (mode === 'hydraulic') {
    const stem = `In a hydraulic system a force of ${force(f)} acts on a piston of area ${area(a)}. The second piston has an area of ${area(b)}. What force does it produce?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([(f * a) / b, f / b, f * b, f + b]), rng).map((v) =>
      force(v)
    ) as [string, string, string];
    return {
      stem,
      correct: force(answer),
      distractors,
      explanation: `Pressure is the same throughout: $\\dfrac{F_1}{A_1} = \\dfrac{F_2}{A_2}$, so $F_2 = \\dfrac{F_1 A_2}{A_1} = \\dfrac{${fmtNumber(f)} \\times ${fmtNumber(b)}}{${fmtNumber(a)}} = ${fmtNumber(answer)}\\text{ N}$.`,
    };
  }

  const stem = `A ${fmtNumber(f)} kg mass sits ${fmtNumber(d)} m from the pivot of a see-saw. How far from the pivot must a ${fmtNumber(b)} kg mass sit to balance it?`;
  const distractors = uniqueNumericDistractors(answer, cleanNumbers([f * d * b, (f * d) / (b * 2), (f * d) / b + 1, f / b]), rng).map(
    (v) => `${fmtNumber(v)} m`
  ) as [string, string, string];
  return {
    stem,
    correct: `${fmtNumber(answer)} m`,
    distractors,
    explanation: `Balanced means $m_1 d_1 = m_2 d_2$, so $d_2 = \\dfrac{m_1 d_1}{m_2} = \\dfrac{${fmtNumber(f)} \\times ${fmtNumber(d)}}{${fmtNumber(b)}} = ${fmtNumber(answer)}\\text{ m}$.`,
  };
}

export const physPressure: QuestionGenerator<PressureParams> = {
  id: 'phys-pressure',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
