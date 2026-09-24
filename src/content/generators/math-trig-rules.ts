import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// The sine rule, the cosine rule and the area of a triangle — the IGCSE "trig beyond 30/60"
// set. Exactness is the whole difficulty here: arbitrary angles give decimal sides, so every
// case is either drawn from a table of angles whose ratios are exact (30/45/60/90, and the
// 60/90/120 angles the cosine rule keeps rational) or filtered out at the draw. The answer
// form is decided by the ratio itself, not by the params table: a ratio of 2 prints as twice
// the side, √2 and √3 print as surds, and a half only draws when the side is even.
//
// Distractors are the named errors: using the sine rule where the cosine rule is needed (or
// the other way round), forgetting the ½ in the area formula, and quoting the complementary
// angle in the angle modes.

const MODES = ['sine-rule-side', 'sine-rule-angle', 'cosine-rule-side', 'cosine-rule-angle', 'area'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** [A, B, a] — the sine rule case, with b = a·sinB/sinA required to be exact. */
  sineSideCases: z
    .array(
      z.tuple([
        z.number().int().min(15).max(120),
        z.number().int().min(15).max(150),
        z.number().int().min(2).max(30),
      ])
    )
    .min(1),
  /** [A, a, b] — the sine rule solving for B, where sinB must be a standard exact value. */
  sineAngleCases: z
    .array(
      z.tuple([
        z.number().int().min(15).max(90),
        z.number().int().min(2).max(30),
        z.number().int().min(2).max(40),
      ])
    )
    .min(1),
  /** [b, c, A] — the cosine rule case, with a² = b² + c² − 2bc·cosA a perfect square. */
  cosineSideCases: z
    .array(
      z.tuple([
        z.number().int().min(2).max(30),
        z.number().int().min(2).max(30),
        z.number().int().min(30).max(150),
      ])
    )
    .min(1),
  /** [a, b, c] — the cosine rule solving for the angle opposite a (must be 60, 90 or 120). */
  cosineAngleCases: z
    .array(
      z.tuple([
        z.number().int().min(2).max(40),
        z.number().int().min(2).max(40),
        z.number().int().min(2).max(40),
      ])
    )
    .min(1),
  /** [b, c, A] — the area case, with ½bc·sinA exact. */
  areaCases: z
    .array(
      z.tuple([
        z.number().int().min(2).max(30),
        z.number().int().min(2).max(30),
        z.number().int().min(30).max(150),
      ])
    )
    .min(1),
});
export type TrigRulesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

/** The exact shape of a ratio's answer: a whole multiple, a half, or a surd coefficient. */
export type FactorKind = 'int' | 'half' | 'sqrt2' | 'sqrt3' | 'other';

export interface TrigRulesValues {
  mode: Mode;
  /** The given angle A, in degrees. */
  angleA: number;
  /** The second given angle B, in degrees (0 where unused). */
  angleB: number;
  /** Sides: a is opposite A; b and c are the other two. */
  a: number;
  b: number;
  c: number;
  /** How the answer is shaped: a whole number, a half, or a surd multiple. */
  kind: FactorKind;
  /** The multiplier of the ratio (1 for the surds, the ratio itself for 'int'/'half'). */
  factor: number;
  /** The computed answer as a number (NaN for the surd forms, which are exact but irrational). */
  answerValue: number;
  /** The printed correct choice. */
  answer: string;
}

const EXACT_SINES: [number, number][] = [
  [0.5, 30],
  [Math.SQRT1_2, 45],
  [Math.sqrt(3) / 2, 60],
  [1, 90],
];

const EXACT_COSINES: [number, number][] = [
  [0.5, 60],
  [0, 90],
  [-0.5, 120],
];

/** The exact multiplier of sinB/sinA, or null when the ratio is not one of the standard ones. */
function exactFactor(ratio: number): { kind: FactorKind; factor: number } | null {
  const table: [number, FactorKind, number][] = [
    [2, 'int', 2],
    [1, 'int', 1],
    [0.5, 'half', 0.5],
    [Math.SQRT2, 'sqrt2', 1],
    [Math.sqrt(3), 'sqrt3', 1],
  ];
  for (const [value, kind, factor] of table) if (Math.abs(ratio - value) < 1e-9) return { kind, factor };
  return null;
}

/** A length whose coefficient is `coef`, in the shape its kind demands. */
export function formatLength(coef: number, kind: FactorKind): string {
  if (kind === 'half') return `${fmtNumber(coef / 2)}`;
  if (kind === 'sqrt2') return `${coef === 1 ? '' : fmtNumber(coef)}\\sqrt{2}`;
  if (kind === 'sqrt3') return `${coef === 1 ? '' : fmtNumber(coef)}\\sqrt{3}`;
  return `${fmtNumber(coef)}`;
}

/** The exact sine of 30/45/60/90, or null for any other angle. */
export function exactSin(degrees: number): number | null {
  const found = EXACT_SINES.find(([, angle]) => angle === degrees);
  return found ? found[0] : null;
}

/** The exact cosine of 60/90/120, or null. */
export function exactCos(degrees: number): number | null {
  for (const [exact, angle] of EXACT_COSINES) if (angle === degrees) return exact;
  return null;
}

const EMPTY: Omit<TrigRulesValues, 'mode' | 'answer' | 'answerValue'> = {
  angleA: 0,
  angleB: 0,
  a: 0,
  b: 0,
  c: 0,
  kind: 'int',
  factor: 1,
};

export function draw(params: TrigRulesParams, rng: Rng): TrigRulesValues {
  const modes = params.modes ?? [...MODES];

  /** [A, B, a] where b = a·sinB/sinA is exact. */
  const sineSide = (): [number, number, number, FactorKind, number] | null => {
    const usable: [number, number, number, FactorKind, number][] = [];
    for (const [A, B, a] of params.sineSideCases) {
      const sinA = exactSin(A);
      const sinB = exactSin(B);
      if (sinA === null || sinB === null) continue;
      const found = exactFactor(sinB / sinA);
      if (!found) continue;
      if (found.kind === 'half' && a % 2 !== 0) continue; // the answer must stay whole
      usable.push([A, B, a, found.kind, found.factor]);
    }
    return usable.length > 0 ? pick(usable, rng) : null;
  };

  /** [A, a, b, B] where sinB is exact AND the triangle is not ambiguous. */
  const sineAngle = (): [number, number, number, number] | null => {
    const usable: [number, number, number, number][] = [];
    for (const [A, a, b] of params.sineAngleCases) {
      const sinA = exactSin(A);
      if (sinA === null) continue;
      const sinB = (b * sinA) / a;
      if (sinB > 1 + 1e-9) continue;
      // Two candidates can satisfy the sine rule; keep only cases where exactly one makes a
      // real triangle, or the question would have two defensible answers.
      const candidates = EXACT_SINES.filter(([value]) => Math.abs(value - sinB) < 1e-9).map(([, angle]) => angle);
      const valid = candidates.filter((B) => A + B < 180);
      if (valid.length === 1) usable.push([A, a, b, valid[0]]);
    }
    return usable.length > 0 ? pick(usable, rng) : null;
  };

  /** [b, c, A, a] where a² = b² + c² − 2bc·cosA is a perfect square. */
  const cosineSide = (): [number, number, number, number] | null => {
    const usable: [number, number, number, number][] = [];
    for (const [b, c, A] of params.cosineSideCases) {
      const cosA = exactCos(A);
      if (cosA === null) continue;
      const square = b * b + c * c - 2 * b * c * cosA;
      const root = Math.sqrt(square);
      if (Number.isInteger(root) && root > 0) usable.push([b, c, A, root]);
    }
    return usable.length > 0 ? pick(usable, rng) : null;
  };

  /** [a, b, c, A] where the angle opposite a is exactly 60, 90 or 120. */
  const cosineAngle = (): [number, number, number, number] | null => {
    const usable: [number, number, number, number][] = [];
    for (const [a, b, c] of params.cosineAngleCases) {
      const cosA = (b * b + c * c - a * a) / (2 * b * c);
      const match = EXACT_COSINES.find(([value]) => Math.abs(value - cosA) < 1e-9);
      if (match) usable.push([a, b, c, match[1]]);
    }
    return usable.length > 0 ? pick(usable, rng) : null;
  };

  /** [b, c, A, kind, factor] where ½bc·sinA is exact. */
  const area = (): [number, number, number, FactorKind, number] | null => {
    const usable: [number, number, number, FactorKind, number][] = [];
    for (const [b, c, A] of params.areaCases) {
      const sinA = exactSin(A);
      if (sinA === null) continue;
      const quarter = (b * c) / 4;
      if (A === 90) {
        usable.push([b, c, A, 'int', (b * c) / 2]);
        continue;
      }
      if (!Number.isInteger(quarter)) continue;
      if (Math.abs(sinA - 0.5) < 1e-9) usable.push([b, c, A, 'int', quarter]);
      else if (Math.abs(sinA - Math.sqrt(3) / 2) < 1e-9) usable.push([b, c, A, 'sqrt3', quarter]);
      else if (Math.abs(sinA - Math.SQRT1_2) < 1e-9) usable.push([b, c, A, 'sqrt2', quarter]);
    }
    return usable.length > 0 ? pick(usable, rng) : null;
  };

  const feasible = modes.filter((mode) => {
    if (mode === 'sine-rule-side') return sineSide() !== null;
    if (mode === 'sine-rule-angle') return sineAngle() !== null;
    if (mode === 'cosine-rule-side') return cosineSide() !== null;
    if (mode === 'cosine-rule-angle') return cosineAngle() !== null;
    return area() !== null;
  });
  if (feasible.length === 0) {
    throw new Error('math-trig-rules: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'sine-rule-side') {
    const [A, B, a, kind, factor] = sineSide()!;
    // formatLength takes the coefficient standing in front of the surd (or the whole value),
    // so a 'half' answer passes the side itself and a 2x answer passes the doubled value.
    const coefficient = kind === 'int' ? a * factor : a;
    const value = kind === 'half' ? a / 2 : kind === 'int' ? a * factor : NaN;
    return {
      ...EMPTY,
      mode,
      angleA: A,
      angleB: B,
      a,
      kind,
      factor,
      answerValue: value,
      answer: `$${formatLength(coefficient, kind)}$ cm`,
    };
  }

  if (mode === 'sine-rule-angle') {
    const [A, a, b, B] = sineAngle()!;
    return {
      ...EMPTY,
      mode,
      angleA: A,
      angleB: B,
      a,
      b,
      answerValue: B,
      answer: `$${fmtNumber(B)}^{\\circ}$`,
    };
  }

  if (mode === 'cosine-rule-side') {
    const [b, c, A, root] = cosineSide()!;
    return { ...EMPTY, mode, angleA: A, b, c, a: root, answerValue: root, answer: `$${fmtNumber(root)}$ cm` };
  }

  if (mode === 'cosine-rule-angle') {
    const [a, b, c, A] = cosineAngle()!;
    return { ...EMPTY, mode, angleA: A, a, b, c, answerValue: A, answer: `$${fmtNumber(A)}^{\\circ}$` };
  }

  const [b, c, A, kind, factor] = area()!;
  void factor;
  return {
    ...EMPTY,
    mode,
    angleA: A,
    b,
    c,
    kind,
    answerValue: kind === 'int' ? (A === 90 ? (b * c) / 2 : (b * c) / 4) : NaN,
    answer: `$${formatLength(A === 90 ? (b * c) / 2 : (b * c) / 4, kind)}\\text{ cm}^2$`,
  };
}

export function build(values: TrigRulesValues, rng: Rng): GeneratorOutput {
  const { mode, angleA, angleB, a, b, c, answer } = values;

  if (mode === 'sine-rule-side') {
    const candidatePool = [1, 2, 3, 4];
    const coef = values.kind === 'int' ? a * values.factor : a;
    return {
      stem: `In triangle $ABC$, angle $A = ${fmtNumber(angleA)}^{\\circ}$, angle $B = ${fmtNumber(
        angleB
      )}^{\\circ}$ and side $a = ${fmtNumber(a)}$ cm. Use the sine rule to find side $b$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          // The given side itself, the answer doubled, and the answer tripled — all built
          // through the same formatter, so a surd answer cannot produce a NaN candidate.
          `$${formatLength(values.kind === 'half' ? a : a, values.kind)}$ cm`,
          `$${formatLength(coef * 2, values.kind)}$ cm`,
          `$${formatLength(coef * 3, values.kind)}$ cm`,
        ],
        candidatePool.map((k) => `$${formatLength(a * k, values.kind)}$ cm`),
        rng
      ),
      explanation: `The sine rule pairs each side with the angle opposite it: $\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$, so $b = \\dfrac{a \\sin B}{\\sin A} = \\dfrac{${fmtNumber(
        a
      )} \\times \\sin ${fmtNumber(angleB)}^{\\circ}}{\\sin ${fmtNumber(angleA)}^{\\circ}} = ${answer}$. ` +
        `Using $\\dfrac{\\sin A}{\\sin B}$ the other way round is the common error.`,
    };
  }

  if (mode === 'sine-rule-angle') {
    const other = 180 - angleB;
    return {
      stem: `In triangle $ABC$, side $a = ${fmtNumber(a)}$ cm, side $b = ${fmtNumber(
        b
      )}$ cm and angle $A = ${fmtNumber(angleA)}^{\\circ}$. Use the sine rule to find angle $B$.`,
      correct: answer,
      distractors: uniqueNumericDistractors(
        angleB,
        [other, 180 - angleA, angleA, 90 - angleB / 2],
        rng
      ).map((v) => `$${fmtNumber(v)}^{\\circ}$`) as [string, string, string],
      explanation: `$\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$, so $\\sin B = \\dfrac{b \\sin A}{a} = \\dfrac{${fmtNumber(
        b
      )} \\times \\sin ${fmtNumber(angleA)}^{\\circ}}{${fmtNumber(a)}}$, giving $B = ${answer}$. ` +
        `The supplment $${fmtNumber(other)}^{\\circ}$ is rejected here because the angles of a triangle must add to $180^{\\circ}$.`,
    };
  }

  if (mode === 'cosine-rule-side') {
    return {
      stem: `A triangle has sides $b = ${fmtNumber(b)}$ cm and $c = ${fmtNumber(
        c
      )}$ cm with the included angle $A = ${fmtNumber(angleA)}^{\\circ}$. Use the cosine rule to find side $a$.`,
      correct: answer,
      distractors: uniqueNumericDistractors(
        values.answerValue,
        [b + c, Math.abs(b - c), Math.round(Math.sqrt(b * b + c * c)), values.answerValue + 2],
        rng
      ).map((v) => `$${fmtNumber(v)}$ cm`) as [string, string, string],
      explanation: `$a^2 = b^2 + c^2 - 2bc\\cos A = ${fmtNumber(b)}^2 + ${fmtNumber(c)}^2 - 2 \\times ${fmtNumber(
        b
      )} \\times ${fmtNumber(c)} \\times \\cos ${fmtNumber(angleA)}^{\\circ} = ${fmtNumber(
        b * b + c * c - 2 * b * c * (Math.abs(angleA - 90) < 1e-9 ? 0 : angleA === 60 ? 0.5 : -0.5)
      )}$, so $a = ${answer}$. Forgetting the $-2bc\\cos A$ term leaves $\\sqrt{b^2 + c^2}$ instead.`,
    };
  }

  if (mode === 'cosine-rule-angle') {
    return {
      stem: `A triangle has sides $a = ${fmtNumber(a)}$ cm, $b = ${fmtNumber(b)}$ cm and $c = ${fmtNumber(
        c
      )}$ cm. Use the cosine rule to find the angle opposite side $a$.`,
      correct: answer,
      distractors: uniqueNumericDistractors(
        angleA,
        [180 - angleA, 90, angleA / 2, angleA + 30],
        rng
      ).map((v) => `$${fmtNumber(v)}^{\\circ}$`) as [string, string, string],
      explanation: `$\\cos A = \\dfrac{b^2 + c^2 - a^2}{2bc} = \\dfrac{${fmtNumber(b * b + c * c - a * a)}}{${fmtNumber(
        2 * b * c
      )}}$, so $A = ${answer}$. Rearranging for the angle is the same formula as finding a side, with the unknown moved.`,
    };
  }

  const areaValue = values.answerValue;
  return {
    stem: `A triangle has sides $b = ${fmtNumber(b)}$ cm and $c = ${fmtNumber(
      c
    )}$ cm with the included angle $A = ${fmtNumber(angleA)}^{\\circ}$. What is its area?`,
    correct: answer,
    distractors: uniqueDistractors(
      answer,
      [
        `$${formatLength(b * c, 'sqrt3')}\\text{ cm}^2$`,
        `$${formatLength(b * c * 2, values.kind)}\\text{ cm}^2$`,
        `$${formatLength(Number.isFinite(areaValue) ? areaValue * 2 : b * c, 'int')}\\text{ cm}^2$`,
        `$${fmtNumber(b * c)}\\text{ cm}^2$`,
      ],
      [`$${fmtNumber(b + c)}\\text{ cm}^2$`, `$${fmtNumber(Math.abs(b - c))}\\text{ cm}^2$`],
      rng
    ),
    explanation: `Area $= \\tfrac{1}{2}bc\\sin A = \\tfrac{1}{2} \\times ${fmtNumber(b)} \\times ${fmtNumber(
      c
    )} \\times \\sin ${fmtNumber(angleA)}^{\\circ} = ${answer}$. Dropping the $\\tfrac{1}{2}$ doubles the area, which is the most common error here.`,
  };
}

export const mathTrigRules: QuestionGenerator<TrigRulesParams> = {
  id: 'math-trig-rules',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
