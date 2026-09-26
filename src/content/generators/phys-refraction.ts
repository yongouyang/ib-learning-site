import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Light formulas: the speed of light in a medium (v = c/n), the refractive index
// from that speed (n = c/v), the power of a lens (P = 1/f), and the law of
// reflection (i = r). Everything is exact by construction: the media table only
// uses refractive indices that divide c = 3 x 10^8 m/s cleanly (1.2, 1.25, 1.5, 2,
// 2.4, 2.5, 3), and the focal-length table only values whose reciprocal prints
// cleanly (0.1, 0.2, 0.25, 0.5, 2, 4, 5 m). Snell's-law numerics stay out — a
// general pair of angles gives decimal answers, and exact-sine angles would need
// surd answers a KS3 topic does not drill.
//
// Distractors are the named errors: multiplying by n instead of dividing (a speed
// faster than light — the sanity check), dividing c by the wrong quantity, quoting
// the focal length as the power, the metre/centimetre slip in P = 1/f, and the
// angle measured from the mirror's surface instead of the normal.

const MODES = ['speed-in-medium', 'index-from-speed', 'lens-power', 'reflection'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Media whose refractive index divides 3e8 m/s cleanly. */
  media: z.array(z.object({ medium: z.string().min(3), n: z.number().min(1.1).max(3) })).min(2),
  /** Focal lengths in metres whose reciprocal is a clean power in dioptres. */
  focalLengths: z.array(z.number().min(0.05).max(10)).min(1),
  /** Angles of incidence in degrees for the reflection mode. */
  angles: z.array(z.number().int().min(10).max(80)).min(1),
});
export type RefractionParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface RefractionValues {
  mode: Mode;
  medium: string;
  n: number;
  /** Speed mantissa: v = mantissa x 10^8 m/s. */
  mantissa: number;
  /** Focal length in metres (lens-power mode). */
  f: number;
  /** Angle of incidence in degrees (reflection mode). */
  angle: number;
  /** Mantissa pool for speed distractors. */
  mantissaPool: number[];
}

export function draw(params: RefractionParams, rng: Rng): RefractionValues {
  const modes = params.modes ?? [...MODES];
  // Only media where v = c/n prints cleanly.
  const usable = params.media.filter(({ n }) => cleanNumbers([3 / n]).length === 1);
  const lenses = params.focalLengths.filter((f) => cleanNumbers([1 / f]).length === 1);
  const feasible = modes.filter((mode) => {
    if (mode === 'speed-in-medium' || mode === 'index-from-speed') return usable.length > 0;
    if (mode === 'lens-power') return lenses.length > 0;
    return params.angles.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('phys-refraction: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  const mantissaPool = usable.map(({ n }) => 3 / n);
  if (mode === 'speed-in-medium' || mode === 'index-from-speed') {
    const { medium, n } = pick(usable, rng);
    return { mode, medium, n, mantissa: 3 / n, f: 0, angle: 0, mantissaPool };
  }
  if (mode === 'lens-power') {
    return { mode, medium: '', n: 0, mantissa: 0, f: pick(lenses, rng), angle: 0, mantissaPool };
  }
  return { mode, medium: '', n: 0, mantissa: 0, f: 0, angle: pick(params.angles, rng), mantissaPool };
}

function sci(mantissa: number): string {
  return `$${fmtNumber(mantissa)} \\times 10^{8}$ m/s`;
}

export function build(values: RefractionValues, rng: Rng): GeneratorOutput {
  const { mode, medium, n, mantissa, f, angle, mantissaPool } = values;

  if (mode === 'speed-in-medium') {
    const correct = sci(mantissa);
    const candidates = [
      // Multiplied by n instead of dividing — a speed faster than light.
      sci(3 * n),
      // The refractive index used as the mantissa.
      sci(n),
    ];
    return {
      stem: `The refractive index of ${medium} is $${fmtNumber(n)}$. The speed of light in a vacuum is $3 \\times 10^8$ m/s. What is the speed of light in ${medium}?`,
      correct,
      distractors: uniqueDistractors(correct, candidates, mantissaPool.map(sci), rng),
      explanation: `$v = \\dfrac{c}{n} = \\dfrac{3 \\times 10^8}{${fmtNumber(n)}} = ${fmtNumber(
        mantissa
      )} \\times 10^8$ m/s. Light slows down in a material, so the answer must be less than $3 \\times 10^8$ m/s — multiplying by $n$ breaks that check.`,
    };
  }

  if (mode === 'index-from-speed') {
    const correct = `$${fmtNumber(n)}$`;
    const distractors = uniqueNumericDistractors(
      n,
      cleanNumbers([mantissa / 3, n * n, 3 * mantissa, 1 / n, n + 0.5]),
      rng
    ).map((v) => `$${fmtNumber(v)}$`) as [string, string, string];
    return {
      stem: `Light travels at $${fmtNumber(mantissa)} \\times 10^{8}$ m/s in ${medium}. The speed of light in a vacuum is $3 \\times 10^8$ m/s. What is the refractive index of ${medium}?`,
      correct,
      distractors,
      explanation: `$n = \\dfrac{c}{v} = \\dfrac{3 \\times 10^8}{${fmtNumber(mantissa)} \\times 10^8} = ${fmtNumber(
        n
      )}$. A refractive index is a pure ratio — no units — and for any material it is greater than $1$.`,
    };
  }

  if (mode === 'lens-power') {
    const power = 1 / f;
    const correct = `$${fmtNumber(power)}$ D`;
    const distractors = uniqueNumericDistractors(
      power,
      cleanNumbers([f, 1 / (100 * f), power + 1, power * 2]),
      rng
    ).map((v) => `$${fmtNumber(v)}$ D`) as [string, string, string];
    return {
      stem: `A convex lens has a focal length of $${fmtNumber(f)}$ m. What is its power in dioptres?`,
      correct,
      distractors,
      explanation: `Power $= \\dfrac{1}{f}$ with $f$ in metres: $\\dfrac{1}{${fmtNumber(f)}} = ${fmtNumber(
        power
      )}$ D. The focal length itself is not the power, and using centimetres in the formula understates it a hundredfold.`,
    };
  }

  const correct = `$${angle}^{\\circ}$`;
  const distractors = uniqueNumericDistractors(
    angle,
    cleanNumbers([90 - angle, 180 - 2 * angle, 2 * angle, angle + 10]),
    rng
  ).map((v) => `$${fmtNumber(v)}^{\\circ}$`) as [string, string, string];
  const surfaceNote =
    90 - angle !== angle
      ? ` The $${fmtNumber(90 - angle)}^{\\circ}$ option is the angle measured from the mirror's surface instead.`
      : '';
  return {
    stem: `A ray of light strikes a plane mirror with an angle of incidence of $${angle}^{\\circ}$. What is the angle of reflection?`,
    correct,
    distractors,
    explanation: `The law of reflection: the angle of reflection equals the angle of incidence, both measured from the normal — so $${angle}^{\\circ}$.${surfaceNote}`,
  };
}

export const physRefraction: QuestionGenerator<RefractionParams> = {
  id: 'phys-refraction',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
