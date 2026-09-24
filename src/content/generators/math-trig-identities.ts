import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Exact trigonometry: degrees to radians and back, the exact values of sin/cos/tan at
// 30/45/60, a trig ratio from a Pythagorean triple with its quadrant sign, sin 2θ from the
// same triple, the arc length and area of a sector, and the four identity simplifications the
// DP question sets actually use. Every answer is exact: radians are built as kπ/n from whole
// multiples, the exact values come straight from the standard triangles, the Pythagorean
// triples are the 3-4-5 family so every ratio is rational, and a sector answer is a fraction
// of π rather than a decimal.
//
// Deliberately absent: solving a trig equation over an interval. Its answer is a SET of
// solutions, and a set that is one solution short is not a defect a distractor pool can make
// safe — those questions stay authored.
//
// Distractors are the named errors: forgetting the quadrant sign, quoting the complementary
// ratio, using the arc-length formula where the area was asked for (and vice versa), and
// inverting the fraction of π.

const MODES = [
  'degrees-to-radians',
  'radians-to-degrees',
  'exact-value',
  'ratio-with-quadrant',
  'double-angle',
  'arc-length',
  'sector-area',
  'simplify-identity',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Whole degrees to convert into radians (kπ/180 reduces for any integer). */
  degrees: z.array(z.number().int().min(15).max(360)).min(1),
  /** The numerator k of a kπ/n radian angle. */
  multiples: z.array(z.number().int().min(1).max(11)).min(1),
  /** The denominator n of a kπ/n radian angle; only those the conversion keeps whole are drawn. */
  denominators: z.array(z.number().int().min(2).max(12)).min(1),
  /** Sector radii in cm. */
  radii: z.array(z.number().int().min(2).max(12)).min(1),
  /** The sector angle as kπ/n. */
  sectorMultiples: z.array(z.number().int().min(1).max(6)).min(1).default([1, 2, 3, 4]),
  sectorDenominators: z.array(z.number().int().min(2).max(6)).min(1).default([2, 3, 4, 6]),
});
export type TrigIdentitiesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];
type TrigFn = 'sin' | 'cos' | 'tan';

export interface TrigValues {
  mode: Mode;
  /** Degrees, for the degree↔radian conversion and the exact values. */
  degrees: number;
  /** Which function the exact-value mode asks about. */
  fn: TrigFn;
  /** The radian angle kπ/n, for the radians-to-degrees and sector modes. */
  radianK: number;
  radianN: number;
  /** The Pythagorean triple [opposite, adjacent, hypotenuse] where one is needed. */
  triple: [number, number, number];
  /** Which quadrant the angle sits in (1–4), for the sign. */
  quadrant: number;
  /** Sector radius in cm (0 where unused). */
  radius: number;
  /** Index into IDENTITIES for the simplify mode (−1 elsewhere). */
  identityIndex: number;
  /** The printed correct choice. */
  answer: string;
  /** The answer as a number where it is one (NaN for the form-answer modes). */
  answerValue: number;
}

export const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

const EXACT_ANGLES: number[] = [30, 45, 60];

/** The four identity simplifications the DP sets use, with their answers and wrong options. */
export const IDENTITIES: { stem: string; correct: string; wrong: string[] }[] = [
  {
    stem: 'Simplify $\\sin^2\\theta + \\cos^2\\theta$.',
    correct: '$1$',
    wrong: ['$2$', '$\\tan^2\\theta$', '$\\sin 2\\theta$', '$0$'],
  },
  {
    stem: 'Simplify $2\\sin\\theta\\cos\\theta$.',
    correct: '$\\sin 2\\theta$',
    wrong: ['$\\cos 2\\theta$', '$\\tan 2\\theta$', '$1$', '$\\sin\\theta + \\cos\\theta$'],
  },
  {
    stem: 'Which expression is equal to $\\cos 2\\theta$?',
    correct: '$\\cos^2\\theta - \\sin^2\\theta$',
    wrong: ['$1 + 2\\sin^2\\theta$', '$\\sin^2\\theta - \\cos^2\\theta$', '$2\\sin\\theta\\cos\\theta$', '$1 - \\cos^2\\theta$'],
  },
  {
    stem: 'Simplify $\\dfrac{1 - \\cos^2\\theta}{\\sin\\theta}$, for $\\sin\\theta \\ne 0$.',
    correct: '$\\sin\\theta$',
    wrong: ['$\\cos\\theta$', '$\\tan\\theta$', '$\\dfrac{1}{\\sin\\theta}$', '$1$'],
  },
];

const EMPTY: Omit<TrigValues, 'mode' | 'answer' | 'answerValue'> = {
  degrees: 0,
  fn: 'sin',
  radianK: 0,
  radianN: 1,
  triple: [3, 4, 5],
  quadrant: 1,
  radius: 0,
  identityIndex: -1,
};

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/** kπ/n in lowest terms as LaTeX (k and n both positive). */
export function piFraction(k: number, n: number): string {
  const g = gcdInt(k, n);
  const numerator = k / g;
  const denominator = n / g;
  const head = numerator === 1 ? '\\pi' : `${numerator}\\pi`;
  return denominator === 1 ? head : `\\dfrac{${head}}{${denominator}}`;
}

/** The exact value of sin/cos/tan at 30/45/60, as LaTeX. */
export function exactValue(fn: TrigFn, degrees: number): string {
  const table: Record<TrigFn, Record<number, string>> = {
    sin: { 30: '\\dfrac{1}{2}', 45: '\\dfrac{\\sqrt{2}}{2}', 60: '\\dfrac{\\sqrt{3}}{2}' },
    cos: { 30: '\\dfrac{\\sqrt{3}}{2}', 45: '\\dfrac{\\sqrt{2}}{2}', 60: '\\dfrac{1}{2}' },
    tan: { 30: '\\dfrac{\\sqrt{3}}{3}', 45: '1', 60: '\\sqrt{3}' },
  };
  return `$${table[fn][degrees]}$`;
}

/** The quadrant sign table: +1 or −1 for each function. */
const QUADRANT_SIGNS: Record<number, { sin: number; cos: number }> = {
  1: { sin: 1, cos: 1 },
  2: { sin: 1, cos: -1 },
  3: { sin: -1, cos: -1 },
  4: { sin: -1, cos: 1 },
};

export function draw(params: TrigIdentitiesParams, rng: Rng): TrigValues {
  const modes = params.modes ?? [...MODES];
  const degrees = params.degrees;
  const multiples = params.multiples;
  const denominators = params.denominators;
  const radii = params.radii;
  const sectorMultiples = params.sectorMultiples ?? [1, 2, 3, 4];
  const sectorDenominators = params.sectorDenominators ?? [2, 3, 4, 6];

  /** A radian angle kπ/n whose degree equivalent is a whole number. */
  const wholeDegreeRadians = (): [number, number] | null => {
    const pairs: [number, number][] = [];
    for (const k of multiples) for (const n of denominators) if (Number.isInteger((k * 180) / n)) pairs.push([k, n]);
    return pairs.length > 0 ? pick(pairs, rng) : null;
  };

  const feasible = modes.filter((mode) => {
    if (mode === 'degrees-to-radians') return degrees.length > 0;
    if (mode === 'radians-to-degrees') return wholeDegreeRadians() !== null;
    if (mode === 'arc-length' || mode === 'sector-area') {
      return radii.length > 0 && sectorMultiples.length > 0 && sectorDenominators.length > 0;
    }
    return true;
  });
  if (feasible.length === 0) {
    throw new Error('math-trig-identities: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const triple = pick(TRIPLES, rng);
  const quadrant = 1 + Math.floor(rng() * 4);
  const radianPair = wholeDegreeRadians() ?? [1, 2];
  const [radianK, radianN] = radianPair;

  if (mode === 'degrees-to-radians') {
    const d = pick(degrees, rng);
    return { ...EMPTY, mode, degrees: d, answer: `$${piFraction(d, 180)}$`, answerValue: NaN };
  }

  if (mode === 'radians-to-degrees') {
    return {
      ...EMPTY,
      mode,
      radianK,
      radianN,
      answer: `$${fmtNumber((radianK * 180) / radianN)}^{\\circ}$`,
      answerValue: (radianK * 180) / radianN,
    };
  }

  if (mode === 'exact-value') {
    const fn = pick(['sin', 'cos', 'tan'] as TrigFn[], rng);
    const angle = pick(EXACT_ANGLES, rng);
    return { ...EMPTY, mode, degrees: angle, fn, answer: exactValue(fn, angle), answerValue: NaN };
  }

  if (mode === 'ratio-with-quadrant') {
    const [opposite, adjacent, hypotenuse] = triple;
    const sign = QUADRANT_SIGNS[quadrant];
    return {
      ...EMPTY,
      mode,
      triple,
      quadrant,
      answer: signedRatio(sign.cos < 0, adjacent, hypotenuse),
      answerValue: (sign.cos * adjacent) / hypotenuse,
    };
  }

  if (mode === 'double-angle') {
    const [opposite, adjacent, hypotenuse] = triple;
    // sin 2θ = 2 sinθ cosθ, and both ratios come from the same triple — rational by design.
    const numerator = 2 * opposite * adjacent;
    const denominator = hypotenuse * hypotenuse;
    const g = gcdInt(numerator, denominator);
    return {
      ...EMPTY,
      mode,
      triple,
      answer: `$\\dfrac{${numerator / g}}{${denominator / g}}$`,
      answerValue: numerator / denominator,
    };
  }

  if (mode === 'arc-length' || mode === 'sector-area') {
    const radius = pick(radii, rng);
    const k = pick(sectorMultiples, rng);
    const n = pick(sectorDenominators, rng);
    const half = mode === 'sector-area';
    return {
      ...EMPTY,
      mode,
      radius,
      radianK: k,
      radianN: n,
      // rθ for the arc, ½r²θ for the area.
      answer: half
        ? `$${piFraction(radius * radius * k, 2 * n)}\\text{ cm}^2$`
        : `$${piFraction(radius * k, n)}\\text{ cm}$`,
      answerValue: NaN,
    };
  }

  const identityIndex = Math.floor(rng() * IDENTITIES.length);
  return { ...EMPTY, mode, identityIndex, answer: IDENTITIES[identityIndex].correct, answerValue: NaN };
}

/** Strip the outer math delimiters so an answer can be embedded INSIDE another math span.
 *  Interpolating a delimited answer into a span is the defect the 2026-09-24 sweep caught in
 *  three places at once: `$... = $\dfrac{1}{2}$.` leaves the first span unterminated. */
function inner(formatted: string): string {
  return formatted.replace(/^\$|\$$/g, '');
}

/** "3/5" or "−3/5" as a LaTeX fraction, signed. */
function signedRatio(negative: boolean, numerator: number, denominator: number): string {
  return `$${negative ? '-' : ''}\\dfrac{${numerator}}{${denominator}}$`;
}

export function build(values: TrigValues, rng: Rng): GeneratorOutput {
  const { mode, degrees, fn, radianK, radianN, triple, quadrant, radius, identityIndex, answer } = values;
  const [opposite, adjacent, hypotenuse] = triple;
  const ordinals = ['first', 'second', 'third', 'fourth'];

  if (mode === 'degrees-to-radians') {
    const pool: string[] = [];
    for (const d of [degrees, 90, 180, 270, 360]) pool.push(`$${piFraction(d, 180)}$`);
    return {
      stem: `Convert $${fmtNumber(degrees)}^{\\circ}$ to radians, giving your answer in terms of $\\pi$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          `$${piFraction(degrees, 360)}$`,
          `$${piFraction(degrees, 90)}$`,
          `$${piFraction(degrees * 2, 180)}$`,
          `$\\dfrac{180\\pi}{${fmtNumber(degrees)}}$`,
        ],
        pool,
        rng
      ),
      explanation: `Multiply by $\\dfrac{\\pi}{180}$: $${fmtNumber(degrees)}^{\\circ} = \\dfrac{${fmtNumber(
        degrees
      )}\\pi}{180}$, which cancels to ${answer}. Dividing by $180$ is the step that is easiest to get the wrong way round.`,
    };
  }

  if (mode === 'radians-to-degrees') {
    const pool: string[] = [];
    for (const n of [2, 3, 4, 6]) for (const k of [1, 2, 3, 4, 5]) pool.push(`$${fmtNumber((k * 180) / n)}^{\\circ}$`);
    return {
      stem: `Convert $${piFraction(radianK, radianN)}$ radians to degrees.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          `$${fmtNumber((radianK * 90) / radianN)}^{\\circ}$`,
          `$${fmtNumber((radianK * 360) / radianN)}^{\\circ}$`,
          `$${fmtNumber((radianN * 180) / radianK)}^{\\circ}$`,
          `$${fmtNumber((radianK * 180) / radianN + 30)}^{\\circ}$`,
        ],
        pool,
        rng
      ),
      explanation: `A full turn is $2\\pi$ radians or $360^{\\circ}$, so each radian is $\\dfrac{180}{\\pi}$ degrees: $${piFraction(radianK, radianN)} \\times \\dfrac{180}{\\pi} = ${fmtNumber(
        (radianK * 180) / radianN
      )}^{\\circ}$.`,
    };
  }

  if (mode === 'exact-value') {
    const wrongs = [exactValue('sin', degrees), exactValue('cos', degrees), exactValue('tan', degrees)].filter(
      (v) => v !== answer
    );
    return {
      stem: `State the exact value of $\\${fn} ${fmtNumber(degrees)}^{\\circ}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        wrongs,
        ['$1$', '$0$', '$\\sqrt{2}$', '$\\dfrac{\\sqrt{3}}{3}$', '$\\dfrac{1}{2}$', '$\\dfrac{\\sqrt{3}}{2}$'],
        rng
      ),
      explanation: `The standard triangles give every exact value at $30^{\\circ}$, $45^{\\circ}$ and $60^{\\circ}$: $\\${fn} ${fmtNumber(
        degrees
      )}^{\\circ} = ${inner(answer)}$. The other options are the values of the complementary or neighbouring functions.`,
    };
  }

  if (mode === 'ratio-with-quadrant') {
    const sign = QUADRANT_SIGNS[quadrant];
    const sinGiven = signedRatio(sign.sin < 0, opposite, hypotenuse);
    const cosAnswer = signedRatio(sign.cos < 0, adjacent, hypotenuse);
    return {
      stem: `Given $\\sin\\theta = ${sinGiven}$ and $\\theta$ is in the ${ordinals[quadrant - 1]} quadrant, find $\\cos\\theta$.`,
      correct: cosAnswer,
      distractors: uniqueDistractors(
        cosAnswer,
        [
          signedRatio(sign.cos > 0, adjacent, hypotenuse),
          `$\\dfrac{${hypotenuse}}{${adjacent}}$`,
          signedRatio(sign.sin < 0, adjacent, hypotenuse + 1),
          signedRatio(sign.cos < 0, opposite, hypotenuse),
        ],
        ['$\\dfrac{4}{5}$', '$-\\dfrac{4}{5}$', '$\\dfrac{3}{5}$', '$-\\dfrac{3}{5}$'],
        rng
      ),
      explanation: `The triple $${opposite}, ${adjacent}, ${hypotenuse}$ gives $\\cos\\theta = \\pm\\dfrac{${adjacent}}{${hypotenuse}}$, and cosine is ${
        sign.cos < 0 ? 'negative' : 'positive'
      } in the ${ordinals[quadrant - 1]} quadrant, so $\\cos\\theta = ${inner(cosAnswer)}$. Forgetting the quadrant sign is what makes the other option tempting.`,
    };
  }

  if (mode === 'double-angle') {
    const numerator = 2 * opposite * adjacent;
    const denominator = hypotenuse * hypotenuse;
    return {
      stem: `Given $\\sin\\theta = \\dfrac{${opposite}}{${hypotenuse}}$ with $\\theta$ in the first quadrant, find $\\sin 2\\theta$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          `$\\dfrac{${opposite * opposite}}{${denominator}}$`,
          `$-\\dfrac{${numerator / gcdInt(numerator, denominator)}}{${denominator / gcdInt(numerator, denominator)}}$`,
          `$\\dfrac{${opposite * adjacent}}{${denominator}}$`,
          `$\\dfrac{${2 * opposite}}{${hypotenuse}}$`,
        ],
        ['$\\dfrac{1}{2}$', '$\\dfrac{3}{5}$', '$\\dfrac{4}{5}$', '$\\dfrac{24}{25}$', '$\\dfrac{7}{25}$'],
        rng
      ),
      explanation: `$\\sin 2\\theta = 2\\sin\\theta\\cos\\theta$, and $\\cos\\theta = \\dfrac{${adjacent}}{${hypotenuse}}$ in the first quadrant. So $\\sin 2\\theta = 2 \\times \\dfrac{${opposite}}{${hypotenuse}} \\times \\dfrac{${adjacent}}{${hypotenuse}} = ${inner(answer)}$.`,
    };
  }

  if (mode === 'arc-length' || mode === 'sector-area') {
    const pool: string[] = [];
    for (const k of [1, 2, 3, 4, 5, 6]) {
      for (const n of [2, 3, 4, 6]) {
        pool.push(`$${piFraction(radius * k, n)}\\text{ cm}$`);
        pool.push(`$${piFraction(radius * radius * k, 2 * n)}\\text{ cm}^2$`);
      }
    }
    const area = mode === 'sector-area';
    const stem = `A sector has radius $${fmtNumber(radius)}$ cm and angle $${piFraction(
      radianK,
      radianN
    )}$ radians. Find ${area ? 'its area' : 'the arc length'}.`;
    const candidates = area
      ? [
          `$${piFraction(radius * radianK, radianN)}\\text{ cm}^2$`,
          `$${piFraction(radius * radius * radianK, radianN)}\\text{ cm}^2$`,
          `$${piFraction(radius * radianK, 2 * radianN)}\\text{ cm}^2$`,
          `$${piFraction(radius * 2 * radianK, radianN)}\\text{ cm}^2$`,
        ]
      : [
          `$${piFraction(radius * radius * radianK, 2 * radianN)}\\text{ cm}$`,
          `$${piFraction(radius * radianK, 2 * radianN)}\\text{ cm}$`,
          `$${piFraction(radius * radianK * 2, radianN)}\\text{ cm}$`,
          `$${piFraction(radianK, radianN)}\\text{ cm}$`,
        ];
    return {
      stem,
      correct: answer,
      distractors: uniqueDistractors(answer, candidates, pool, rng),
      explanation: area
        ? `Sector area $= \\tfrac{1}{2}r^2\\theta = \\tfrac{1}{2} \\times ${fmtNumber(
            radius
          )}^2 \\times ${piFraction(radianK, radianN)} = ${answer}$. $r\\theta$ gives the arc length instead, which is the ${fmtNumber(
            radius
          )}-times-smaller mistake.`
        : `Arc length $= r\\theta = ${fmtNumber(radius)} \\times ${piFraction(radianK, radianN)} = ${answer}$. The sector area is $\\tfrac{1}{2}r^2\\theta$, which is where an extra factor of $r$ and a $\\tfrac{1}{2}$ come from.`,
    };
  }

  const identity = IDENTITIES[Math.max(0, identityIndex)];
  return {
    stem: identity.stem,
    correct: identity.correct,
    distractors: uniqueDistractors(
      identity.correct,
      identity.wrong.slice(0, 3),
      [...identity.wrong, '$1$', '$0$', '$\\cos^2\\theta$', '$\\sin^2\\theta$', '$\\tan^2\\theta$'],
      rng
    ),
    explanation: `This is one of the Pythagorean and double-angle identities: the expression simplifies to ${identity.correct}. $\\sin^2\\theta + \\cos^2\\theta = 1$ and $\\sin 2\\theta = 2\\sin\\theta\\cos\\theta$ are the two to learn first.`,
  };
}

export const mathTrigIdentities: QuestionGenerator<TrigIdentitiesParams> = {
  id: 'math-trig-identities',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
