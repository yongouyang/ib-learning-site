import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Circle theorems: one mode per theorem the IGCSE question set actually asks — angle at the
// centre, angle at the circumference, a point on the minor arc, angles in the same segment,
// a cyclic quadrilateral, the angle in a semicircle, tangent-radius, the alternate segment,
// equal tangents from a point, and the isosceles triangle two tangents make. Every answer is
// an integer by construction: the central angle is always drawn as twice its inscribed
// angle, the semicircle mode only draws acute given angles, and the tangent mode only draws
// even angles (so the base angles are whole degrees).
//
// Distractors are the named errors: quoting the central angle when the circumference was
// asked for (and vice versa), halving where the theorem doubles, using the reflex angle, and
// treating the given angle as the answer.

const MODES = [
  'angle-at-centre',
  'angle-at-circumference',
  'minor-arc',
  'same-segment',
  'cyclic-quadrilateral',
  'semicircle',
  'tangent-radius',
  'alternate-segment',
  'two-tangents-length',
  'two-tangents-angle',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Inscribed (or base) angles in whole degrees; the central angle is always twice one of these. */
  angles: z.array(z.number().int().min(10).max(85)).min(1),
  /** The angle between two tangents from an external point — even, so the base angles are whole. */
  tangentAngles: z.array(z.number().int().min(10).max(140)).min(1).default([20, 30, 40, 50, 60, 70, 80]),
  /** Tangent lengths in cm. */
  lengths: z.array(z.number().int().min(2).max(40)).min(1).default([5, 6, 7, 9, 12, 14]),
});
export type CircleTheoremsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface CircleValues {
  mode: Mode;
  /** The given angle (degrees) — 0 where the mode has none. */
  a: number;
  /** The tangent angle between the two tangents (degrees) — 0 where unused. */
  tangent: number;
  /** The given tangent length (cm) — 0 where unused. */
  length: number;
  /** The computed answer, in degrees or cm depending on the mode. */
  answerValue: number;
  /** 'deg' for an angle, 'cm' for a length. */
  unit: 'deg' | 'cm';
}

const EMPTY: Omit<CircleValues, 'mode' | 'answerValue' | 'unit'> = { a: 0, tangent: 0, length: 0 };

export function draw(params: CircleTheoremsParams, rng: Rng): CircleValues {
  const modes = params.modes ?? [...MODES];
  const angles = params.angles;
  const tangentAngles = params.tangentAngles ?? [20, 30, 40, 50, 60, 70, 80];
  const lengths = params.lengths ?? [5, 6, 7, 9, 12, 14];

  const feasible = modes.filter((mode) => {
    if (mode === 'semicircle') return angles.some((a) => a < 90);
    if (mode === 'two-tangents-angle') return tangentAngles.some((t) => t % 2 === 0 && t > 0 && t < 180);
    if (mode === 'two-tangents-length') return lengths.length > 0;
    if (mode === 'tangent-radius') return true;
    return angles.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-circle-theorems: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'two-tangents-length') {
    const length = pick(lengths, rng);
    return { ...EMPTY, mode, length, answerValue: length, unit: 'cm' };
  }

  if (mode === 'two-tangents-angle') {
    const tangent = pick(tangentAngles.filter((t) => t % 2 === 0 && t > 0 && t < 180), rng);
    // PA = PB makes triangle APB isosceles, so each base angle is (180 - t)/2.
    return { ...EMPTY, mode, tangent, answerValue: (180 - tangent) / 2, unit: 'deg' };
  }

  if (mode === 'tangent-radius') {
    // The radius meets the tangent at 90 degrees — no param needed, but the distractors do.
    return { ...EMPTY, mode, answerValue: 90, unit: 'deg' };
  }

  const a = pick(angles, rng);

  if (mode === 'semicircle') {
    // The angle in a semicircle is 90, so the other acute angle is 90 - a.
    const acute = pick(angles.filter((v) => v < 90), rng);
    return { ...EMPTY, mode, a: acute, answerValue: 90 - acute, unit: 'deg' };
  }

  if (mode === 'angle-at-centre') {
    return { ...EMPTY, mode, a, answerValue: 2 * a, unit: 'deg' };
  }

  if (mode === 'angle-at-circumference') {
    // The given central angle is drawn as twice its inscribed partner, so the halving is exact.
    return { ...EMPTY, mode, a: 2 * a, answerValue: a, unit: 'deg' };
  }

  if (mode === 'minor-arc') {
    // C on the minor arc: the angle at the circumference is the supplement of the half.
    return { ...EMPTY, mode, a: 2 * a, answerValue: 180 - a, unit: 'deg' };
  }

  if (mode === 'cyclic-quadrilateral') {
    return { ...EMPTY, mode, a, answerValue: 180 - a, unit: 'deg' };
  }

  // same-segment and alternate-segment both repeat the given angle.
  return { ...EMPTY, mode, a, answerValue: a, unit: 'deg' };
}

export function build(values: CircleValues, rng: Rng): GeneratorOutput {
  const { mode, a, tangent, length } = values;
  const answer = values.answerValue;
  const deg = (v: number): string => `$${fmtNumber(v)}^{\\circ}$`;
  const choices = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(
      answer,
      // Whole degrees only: a distractor like 12.5° in an angle question reads as a mistake,
      // not as a plausible wrong answer.
      candidates.filter((v) => Number.isInteger(v) && v > 0 && v < 360),
      rng
    ).map((v) => (values.unit === 'cm' ? `$${fmtNumber(v)}$ cm` : deg(v))) as [string, string, string];
  const correct = values.unit === 'cm' ? `$${fmtNumber(answer)}$ cm` : deg(answer);

  if (mode === 'angle-at-centre') {
    return {
      stem: `$A$ and $B$ are points on a circle with centre $O$. Angle $ACB = ${deg(
        a
      )}$, where $C$ lies on the major arc $AB$. Work out angle $AOB$.`,
      correct,
      distractors: choices([a, 180 - a, 360 - 2 * a, a / 2]),
      explanation: `The angle at the centre is twice the angle at the circumference when both stand on the same arc, so angle $AOB = 2 \\times ${fmtNumber(a)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$. $${fmtNumber(a)}^{\\circ}$ is the angle you were given, and $${fmtNumber(360 - 2 * a)}^{\\circ}$ would be the reflex angle at $O$.`,
    };
  }

  if (mode === 'angle-at-circumference') {
    const central = a;
    return {
      stem: `$A$ and $B$ are points on a circle with centre $O$ and angle $AOB = ${deg(
        central
      )}$. $C$ lies on the major arc $AB$. Work out angle $ACB$.`,
      correct,
      distractors: choices([central, 2 * central, 180 - answer, 360 - central]),
      explanation: `The angle at the circumference is half the angle at the centre standing on the same arc, so angle $ACB = ${fmtNumber(central)}^{\\circ} \\div 2 = ${fmtNumber(answer)}^{\\circ}$. $${fmtNumber(central)}^{\\circ}$ is the central angle itself.`,
    };
  }

  if (mode === 'minor-arc') {
    const central = a;
    return {
      stem: `$A$ and $B$ are points on a circle with centre $O$ and the minor angle $AOB = ${deg(
        central
      )}$. $C$ is a point on the MINOR arc $AB$. Work out angle $ACB$.`,
      correct,
      distractors: choices([central / 2, central, 180 - central / 2, 2 * central]),
      explanation: `When $C$ sits on the minor arc the angle at the circumference is half the reflex angle at $O$: $360^{\\circ} - ${fmtNumber(central)}^{\\circ} = ${fmtNumber(
        360 - central
      )}^{\\circ}$, halved gives $${fmtNumber(answer)}^{\\circ}$. Halving the minor angle instead would give $${fmtNumber(central / 2)}^{\\circ}$.`,
    };
  }

  if (mode === 'same-segment') {
    return {
      stem: `Points $A$, $B$, $C$ and $D$ lie on a circle. Angles $DAC$ and $DBC$ stand on the chord $DC$, with $A$ and $B$ on the SAME arc. Angle $DAC = ${deg(
        a
      )}$. Work out angle $DBC$.`,
      correct,
      distractors: choices([180 - a, 2 * a, a / 2, 90 - a]),
      explanation: `Angles in the same segment are equal, so angle $DBC = ${fmtNumber(
        a
      )}^{\\circ}$ as well. $${fmtNumber(180 - a)}^{\\circ}$ is what you would get if the two angles were opposite each other in a cyclic quadrilateral.`,
    };
  }

  if (mode === 'cyclic-quadrilateral') {
    return {
      stem: `$ABCD$ is a cyclic quadrilateral. Angle $DAB = ${deg(a)}$. Work out angle $BCD$.`,
      correct,
      distractors: choices([a, 360 - a, 90, 180 - a / 2]),
      explanation: `Opposite angles of a cyclic quadrilateral add to $180^{\\circ}$, so angle $BCD = 180^{\\circ} - ${fmtNumber(a)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$. The angles are supplementary, not equal.`,
    };
  }

  if (mode === 'semicircle') {
    return {
      stem: `$AB$ is a diameter of a circle and $C$ is a point on the circumference. Angle $CAB = ${deg(
        a
      )}$. Work out angle $ABC$.`,
      correct,
      distractors: choices([90, 180 - a, a, 90 + a]),
      explanation: `The angle in a semicircle is $90^{\\circ}$, so triangle $ABC$ has a right angle at $C$. The angles of a triangle add to $180^{\\circ}$, so angle $ABC = 90^{\\circ} - ${fmtNumber(a)}^{\\circ} = ${fmtNumber(answer)}^{\\circ}$. $${fmtNumber(180 - a)}^{\\circ}$ forgets the right angle.`,
    };
  }

  if (mode === 'tangent-radius') {
    return {
      stem: `$PT$ is a tangent to a circle with centre $O$, touching the circle at $T$. $OT$ is a radius. Work out angle $OTP$.`,
      correct,
      distractors: choices([45, 60, 180, 30]),
      explanation: `A tangent is perpendicular to the radius at the point of contact, so angle $OTP = 90^{\\circ}$ whatever the size of the circle.`,
    };
  }

  if (mode === 'alternate-segment') {
    return {
      stem: `A tangent is drawn at point $A$ on a circle, and $AB$ is a chord. The angle between the tangent and the chord $AB$ is ${deg(
        a
      )}. $C$ is a point on the major arc $AB$. Work out angle $ACB$.`,
      correct,
      distractors: choices([180 - a, 2 * a, 90 - a, a / 2]),
      explanation: `By the alternate segment theorem the angle between the tangent and the chord equals the angle in the alternate segment, so angle $ACB = ${fmtNumber(
        a
      )}^{\\circ}$. The two angles are equal, not supplementary.`,
    };
  }

  if (mode === 'two-tangents-length') {
    return {
      stem: `From a point $P$ outside a circle, two tangents $PA$ and $PB$ touch the circle at $A$ and $B$. If $PA = ${fmtNumber(
        length
      )}$ cm, what is $PB$?`,
      correct,
      distractors: choices([length * 2, length / 2, length + 2, length - 1]),
      explanation: `Tangents drawn from the same external point are equal in length, so $PB = PA = ${fmtNumber(
        length
      )}$ cm.`,
    };
  }

  const base = (180 - tangent) / 2;
  return {
    stem: `$PA$ and $PB$ are tangents to a circle from the external point $P$, touching at $A$ and $B$. Angle $APB = ${deg(
      tangent
    )}$. Work out angle $PAB$.`,
    correct,
    distractors: choices([tangent, 180 - tangent, 90 - tangent / 2, base + 5]),
    explanation: `$PA = PB$ (equal tangents), so triangle $APB$ is isosceles and the two base angles are equal. They share the remaining $180^{\\circ} - ${fmtNumber(
      tangent
    )}^{\\circ} = ${fmtNumber(180 - tangent)}^{\\circ}$, so angle $PAB = ${fmtNumber(180 - tangent)}^{\\circ} \\div 2 = ${fmtNumber(base)}^{\\circ}$. $${fmtNumber(
      tangent
    )}^{\\circ}$ is the angle at $P$, not a base angle.`,
  };
}

export const mathCircleTheorems: QuestionGenerator<CircleTheoremsParams> = {
  id: 'math-circle-theorems',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
