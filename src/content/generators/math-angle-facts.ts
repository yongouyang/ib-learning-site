import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Angle facts: the missing angle on a straight line, at a point, in a triangle, in a
// quadrilateral and at the base of an isosceles triangle, plus the regular-polygon
// rules (interior sum, one exterior angle, one interior angle, sides from an exterior
// angle). Every answer is an integer by construction: the isosceles apex is drawn even
// and the polygon modes only draw side counts (or exterior angles) that divide 360.
//
// Distractors are the named errors: using 360 where the fact says 180, forgetting to
// halve the isosceles remainder, quoting the exterior angle when the interior was
// asked for, and dropping one of the given angles.

const MODES = [
  'straight-line',
  'at-a-point',
  'vertically-opposite',
  'corresponding',
  'alternate',
  'co-interior',
  'triangle',
  'quadrilateral',
  'isosceles-base',
  'polygon-interior-sum',
  'exterior-regular',
  'interior-regular',
  'sides-from-exterior',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Given angles, in degrees. */
  angles: z.array(z.number().int().min(1).max(179)).min(1),
  /** Side counts for the polygon modes; only those dividing 360 can draw an angle mode. */
  polygons: z
    .array(z.number().int().min(3).max(12))
    .min(1)
    .default([3, 4, 5, 6, 8, 9, 10, 12]),
  /** Exterior angles for the "how many sides" mode; only divisors of 360 can draw. */
  exteriors: z
    .array(z.number().int().min(1).max(120))
    .min(1)
    .default([15, 20, 24, 30, 36, 40, 45, 60, 72]),
});
export type AngleFactsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface AngleFactsValues {
  mode: Mode;
  /** First given angle (or the apex, or the exterior angle). */
  a: number;
  /** Second given angle (0 when unused). */
  b: number;
  /** Third given angle (0 when unused). */
  c: number;
  /** Side count for the polygon modes (0 when unused). */
  n: number;
  answer: number;
}

const positive = (values: number[]): number[] => cleanNumbers(values).filter((v) => v > 0);

export function draw(params: AngleFactsParams, rng: Rng): AngleFactsValues {
  const modes = params.modes ?? [...MODES];
  const angles = params.angles;
  const polygons = params.polygons ?? [3, 4, 5, 6, 8, 9, 10, 12];
  const exteriors = params.exteriors ?? [15, 20, 24, 30, 36, 40, 45, 60, 72];

  // Only the modes this param table can answer in whole degrees are drawn.
  const feasible = modes.filter((m) => {
    if (m === 'triangle') return angles.some((a) => angles.some((b) => a + b < 180));
    if (m === 'quadrilateral' || m === 'at-a-point') {
      return angles.some((a) => angles.some((b) => angles.some((c) => a + b + c < 360)));
    }
    if (m === 'isosceles-base') return angles.some((a) => a % 2 === 0);
    if (m === 'polygon-interior-sum') return polygons.length > 0;
    if (m === 'exterior-regular' || m === 'interior-regular') return polygons.some((n) => 360 % n === 0);
    if (m === 'sides-from-exterior') return exteriors.some((e) => 360 % e === 0);
    return angles.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-angle-facts: no mode is feasible for this param table — add angles/polygons/exteriors');
  }
  const mode = pick(feasible, rng);

  if (mode === 'triangle') {
    const pairs: [number, number][] = [];
    for (const a of angles) for (const b of angles) if (a + b < 180) pairs.push([a, b]);
    const [a, b] = pick(pairs, rng);
    return { mode, a, b, c: 0, n: 0, answer: 180 - a - b };
  }
  if (mode === 'quadrilateral' || mode === 'at-a-point') {
    const triples: [number, number, number][] = [];
    for (const a of angles)
      for (const b of angles) for (const c of angles) if (a + b + c < 360) triples.push([a, b, c]);
    const [a, b, c] = pick(triples, rng);
    const answer = mode === 'quadrilateral' ? 360 - a - b - c : 360 - a - b - c;
    return { mode, a, b, c, n: 0, answer };
  }
  if (mode === 'isosceles-base') {
    const apexes = angles.filter((a) => a % 2 === 0);
    const a = pick(apexes, rng);
    return { mode, a, b: 0, c: 0, n: 0, answer: (180 - a) / 2 };
  }
  if (mode === 'polygon-interior-sum') {
    const n = pick(polygons, rng);
    return { mode, a: 0, b: 0, c: 0, n, answer: (n - 2) * 180 };
  }
  if (mode === 'exterior-regular' || mode === 'interior-regular') {
    const usable = polygons.filter((n) => 360 % n === 0);
    const n = pick(usable, rng);
    const exterior = 360 / n;
    return { mode, a: 0, b: 0, c: 0, n, answer: mode === 'exterior-regular' ? exterior : 180 - exterior };
  }
  if (mode === 'sides-from-exterior') {
    const usable = exteriors.filter((e) => 360 % e === 0);
    const e = pick(usable, rng);
    return { mode, a: e, b: 0, c: 0, n: 0, answer: 360 / e };
  }
  const a = pick(angles, rng);
  const supplement = mode === 'straight-line' || mode === 'co-interior';
  return { mode, a, b: 0, c: 0, n: 0, answer: supplement ? 180 - a : a };
}

function deg(value: number): string {
  return `$${fmtNumber(value)}^{\\circ}$`;
}

export function build(values: AngleFactsValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, c, n, answer } = values;
  const choices = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(answer, positive(candidates), rng).map((v) => deg(v)) as [string, string, string];

  if (mode === 'straight-line') {
    const distractors = choices([a, 360 - a, 180 + a]);
    const note = distractors.includes(deg(a))
      ? ` The ${deg(a)} option is the angle you were given, not the one left over.`
      : '';
    return {
      stem: `Two angles lie on a straight line. One of them is ${deg(a)}. What is the other angle?`,
      correct: deg(answer),
      distractors,
      explanation: `Angles on a straight line add to $180^{\\circ}$, so the other angle is $180^{\\circ} - ${fmtNumber(a)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$.${note}`,
    };
  }

  if (mode === 'at-a-point') {
    const distractors = choices([180 - a - b - c, 360 - a - b, a + b + c]);
    return {
      stem: `Three of the angles at a point are ${deg(a)}, ${deg(b)} and ${deg(c)}. What is the fourth angle?`,
      correct: deg(answer),
      distractors,
      explanation: `Angles at a point add to $360^{\\circ}$, so the fourth angle is $360^{\\circ} - ${fmtNumber(a)}^{\\circ} - ${fmtNumber(b)}^{\\circ} - ${fmtNumber(c)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$.`,
    };
  }

  if (mode === 'vertically-opposite') {
    const distractors = choices([180 - a, 360 - a, 2 * a]);
    return {
      stem: `Two straight lines cross. One of the angles formed is ${deg(a)}. What is the vertically opposite angle?`,
      correct: deg(answer),
      distractors,
      explanation: `Vertically opposite angles are equal, so the opposite angle is also ${deg(answer)}; ${deg(180 - a)} would be the adjacent angle on the straight line.`,
    };
  }

  if (mode === 'corresponding' || mode === 'alternate' || mode === 'co-interior') {
    const pair = mode === 'co-interior' ? 'co-interior' : mode;
    const distractors = choices([180 - a, 360 - a, 2 * a]);
    const rule =
      mode === 'co-interior'
        ? `Co-interior angles add to $180^{\circ}$, so the other one is $180^{\circ} - ${fmtNumber(a)}^{\circ} = ${fmtNumber(answer)}^{\circ}$.`
        : `${mode === 'corresponding' ? 'Corresponding' : 'Alternate'} angles are equal, so the other ${pair} angle is also ${deg(answer)}; ${deg(180 - a)} is the angle on the straight line.`;
    return {
      stem: `Two parallel lines are crossed by a transversal. One ${pair} angle is ${deg(a)}. What is the other ${pair} angle?`,
      correct: deg(answer),
      distractors,
      explanation: rule,
    };
  }

  if (mode === 'triangle') {
    const distractors = choices([180 - a, 360 - a - b, a + b]);
    const note = distractors.includes(deg(180 - a))
      ? ` The ${deg(180 - a)} option forgets the second angle.`
      : '';
    return {
      stem: `Two angles of a triangle are ${deg(a)} and ${deg(b)}. What is the third angle?`,
      correct: deg(answer),
      distractors,
      explanation: `Angles in a triangle add to $180^{\\circ}$, so the third angle is $180^{\\circ} - ${fmtNumber(a)}^{\\circ} - ${fmtNumber(b)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$.${note}`,
    };
  }

  if (mode === 'quadrilateral') {
    const distractors = choices([180 - a - b - c, 360 - a - b, a + b + c]);
    return {
      stem: `Three angles of a quadrilateral are ${deg(a)}, ${deg(b)} and ${deg(c)}. What is the fourth angle?`,
      correct: deg(answer),
      distractors,
      explanation: `Angles in a quadrilateral add to $360^{\\circ}$, so the fourth angle is $360^{\\circ} - ${fmtNumber(a)}^{\\circ} - ${fmtNumber(b)}^{\\circ} - ${fmtNumber(c)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$.`,
    };
  }

  if (mode === 'isosceles-base') {
    const distractors = choices([180 - a, a, (180 + a) / 2]);
    const note = distractors.includes(deg(180 - a))
      ? ` The ${deg(180 - a)} option is both base angles together — the question asks for one.`
      : '';
    return {
      stem: `An isosceles triangle has an apex angle of ${deg(a)}. What is the size of each base angle?`,
      correct: deg(answer),
      distractors,
      explanation: `The two base angles are equal, so each is $\\dfrac{180^{\\circ} - ${fmtNumber(a)}^{\\circ}}{2} = ${fmtNumber(answer)}^{\\circ}$.${note}`,
    };
  }

  if (mode === 'polygon-interior-sum') {
    const distractors = choices([(n - 1) * 180, (n - 2) * 360, (n - 3) * 180]);
    return {
      stem: `What is the sum of the interior angles of a polygon with ${fmtNumber(n)} sides?`,
      correct: deg(answer),
      distractors,
      explanation: `A polygon with $n$ sides splits into $n - 2$ triangles, so the interior angles add to $( ${fmtNumber(n)} - 2 ) \\times 180^{\\circ} = ${fmtNumber(answer)}^{\\circ}$.`,
    };
  }

  if (mode === 'exterior-regular') {
    const interior = 180 - answer;
    const distractors = choices([interior, answer * 2, answer / 2]);
    const note = distractors.includes(deg(interior))
      ? ` The ${deg(interior)} option is the interior angle.`
      : '';
    return {
      stem: `What is the size of one exterior angle of a regular polygon with ${fmtNumber(n)} sides?`,
      correct: deg(answer),
      distractors,
      explanation: `The exterior angles of any polygon add to $360^{\\circ}$, so one exterior angle is $\\dfrac{360^{\\circ}}{${fmtNumber(n)}} = ${fmtNumber(answer)}^{\\circ}$.${note}`,
    };
  }

  if (mode === 'interior-regular') {
    const exterior = 360 / n;
    const distractors = choices([exterior, (n - 2) * 180, answer + exterior]);
    const note = distractors.includes(deg(exterior))
      ? ` The ${deg(exterior)} option is the exterior angle.`
      : '';
    return {
      stem: `What is the size of one interior angle of a regular polygon with ${fmtNumber(n)} sides?`,
      correct: deg(answer),
      distractors,
      explanation: `Interior and exterior angles are on a straight line, so the interior angle is $180^{\\circ} - \\dfrac{360^{\\circ}}{${fmtNumber(n)}} = ${fmtNumber(answer)}^{\\circ}$.${note}`,
    };
  }

  // The answer is a side COUNT, not an angle, so these choices carry no degree sign.
  const counts = uniqueNumericDistractors(answer, positive([answer + 1, answer - 1, 180 / a]), rng).map((v) =>
    fmtNumber(v)
  ) as [string, string, string];
  return {
    stem: `A regular polygon has an exterior angle of ${deg(a)}. How many sides does it have?`,
    correct: `${fmtNumber(answer)}`,
    distractors: counts,
    explanation: `The exterior angles add to $360^{\\circ}$, so the number of sides is $\\dfrac{360^{\\circ}}{${fmtNumber(a)}^{\\circ}} = ${fmtNumber(answer)}$.`,
  };
}

export const mathAngleFacts: QuestionGenerator<AngleFactsParams> = {
  id: 'math-angle-facts',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
