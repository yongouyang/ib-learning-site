import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Pythagoras and right-angled trigonometry: the hypotenuse, a shorter side, the
// distance between two points, the exact trig ratios of 30/45/60, a side found from
// an angle in a 30-60-90 triangle, and the angle from a known ratio.
//
// Every instance is CONSTRUCTED so no answer needs rounding: the side modes work
// from scaled Pythagorean triples (and the coordinate mode displaces by exactly one),
// the side-from-angle modes only use 30 and 60 degrees where the ratio is a clean
// halving, and the ratio mode reads straight off the exact-value table.
//
// NOT mechanized: arbitrary-angle trigonometry (sin 40, angles of elevation to 1 d.p.)
// — those answers are decimals by definition, which is a different generator.

const MODES = ['hypotenuse', 'leg', 'distance', 'trig-ratio', 'trig-side', 'trig-angle'] as const;

/** Exact values of the three ratios at the three special angles. */
const RATIOS: { fn: 'sin' | 'cos' | 'tan'; angle: 30 | 45 | 60; latex: string }[] = [
  { fn: 'sin', angle: 30, latex: String.raw`\dfrac{1}{2}` },
  { fn: 'cos', angle: 30, latex: String.raw`\dfrac{\sqrt{3}}{2}` },
  { fn: 'tan', angle: 30, latex: String.raw`\dfrac{\sqrt{3}}{3}` },
  { fn: 'sin', angle: 45, latex: String.raw`\dfrac{\sqrt{2}}{2}` },
  { fn: 'cos', angle: 45, latex: String.raw`\dfrac{\sqrt{2}}{2}` },
  { fn: 'tan', angle: 45, latex: '1' },
  { fn: 'sin', angle: 60, latex: String.raw`\dfrac{\sqrt{3}}{2}` },
  { fn: 'cos', angle: 60, latex: String.raw`\dfrac{1}{2}` },
  { fn: 'tan', angle: 60, latex: String.raw`\sqrt{3}` },
];

const RATIO_POOL = [...new Set(RATIOS.map((r) => r.latex))];

/** Plausible angles for the "find θ" mode — 90 included so the third distractor is
 * never an invented 29°/31° from the padding path. */
const ANGLE_CHOICES = [30, 45, 60, 90];

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Primitive Pythagorean triples; scaled by `scales`. */
    triples: z
      .array(z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]))
      .min(1)
      .default([
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
        [20, 21, 29],
      ]),
    /** Integer scale factors applied to a triple. */
    scales: z.array(z.number().int().positive()).min(1).default([1, 2, 3]),
    /** Even hypotenuses (and doubled legs) for the 30/60 side-from-angle mode. */
    hypots: z.array(z.number().int().positive()).min(1).default([10, 12, 14, 16, 18, 20, 24, 30]),
    /** Start points for the coordinate mode. */
    origins: z
      .array(z.tuple([z.number().int(), z.number().int()]))
      .min(1)
      .default([
        [0, 0],
        [1, 2],
        [-3, 4],
        [2, -5],
      ]),
  })
  .refine((p) => p.triples.every(([a, b, c]) => a * a + b * b === c * c), {
    message: 'math-pythagoras-trig: every triple must satisfy a² + b² = c²',
  });
export type PythagorasParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface PythagorasValues {
  mode: Mode;
  /** First leg / x-coordinate / ratio index. */
  a: number;
  /** Second leg / y-coordinate / unused. */
  b: number;
  c: number;
  /** Which leg was given in the `leg` mode (0 = a, 1 = b). */
  given: 0 | 1;
  /** Start point for the coordinate mode. */
  x0: number;
  y0: number;
  /** Degrees for the trig modes. */
  angle: 30 | 45 | 60;
  fn: 'sin' | 'cos' | 'tan';
  /** LaTeX of the correct ratio (trig-ratio mode). */
  ratio: string;
  answer: number;
}

export function draw(params: PythagorasParams, rng: Rng): PythagorasValues {
  const modes = params.modes ?? [...MODES];
  const triples = params.triples ?? [[3, 4, 5]];
  const scales = params.scales ?? [1];
  const hypots = params.hypots ?? [10, 12, 14, 16, 18, 20, 24, 30];
  const origins = params.origins ?? [[0, 0]];
  const evens = hypots.filter((h) => h % 2 === 0);

  const feasible = modes.filter((m) => {
    if (m === 'trig-ratio' || m === 'trig-angle') return true;
    if (m === 'trig-side') return evens.length > 0;
    return triples.length > 0 && scales.length > 0 && (m !== 'distance' || origins.length > 0);
  });
  if (feasible.length === 0) {
    throw new Error('math-pythagoras-trig: no mode is feasible for this param table — add triples/scales/hypots');
  }
  const mode = pick(feasible, rng);

  if (mode === 'trig-ratio') {
    const entry = pick(RATIOS, rng);
    return {
      mode,
      a: 0,
      b: 0,
      c: 0,
      given: 0,
      x0: 0,
      y0: 0,
      angle: entry.angle,
      fn: entry.fn,
      ratio: entry.latex,
      answer: 0,
    };
  }

  if (mode === 'trig-angle') {
    // sin θ = 1/2 -> 30, cos θ = 1/2 -> 60, tan θ = 1 -> 45.
    const entry = pick(
      [
        { fn: 'sin' as const, value: String.raw`\dfrac{1}{2}`, angle: 30 as const },
        { fn: 'cos' as const, value: String.raw`\dfrac{1}{2}`, angle: 60 as const },
        { fn: 'tan' as const, value: '1', angle: 45 as const },
      ],
      rng
    );
    return {
      mode,
      a: 0,
      b: 0,
      c: 0,
      given: 0,
      x0: 0,
      y0: 0,
      angle: entry.angle,
      fn: entry.fn,
      ratio: entry.value,
      answer: entry.angle,
    };
  }

  if (mode === 'trig-side') {
    const h = pick(evens, rng);
    const angle: 30 | 60 = rng() < 0.5 ? 30 : 60;
    // 30°: the side opposite is half the hypotenuse. 60°: the side adjacent is half.
    const findOpposite = rng() < 0.5;
    if (findOpposite) {
      return { mode, a: h, b: 0, c: 0, given: 0, x0: 0, y0: 0, angle, fn: 'sin', ratio: '', answer: h / 2 };
    }
    return { mode, a: h / 2, b: 0, c: 0, given: 0, x0: 0, y0: 0, angle, fn: 'cos', ratio: '', answer: h };
  }

  const [a0, b0, c0] = pick(triples, rng);
  const k = pick(scales, rng);
  const a = a0 * k;
  const b = b0 * k;
  const c = c0 * k;

  if (mode === 'distance') {
    const [x0, y0] = pick(origins, rng);
    return { mode, a, b, c, given: 0, x0, y0, angle: 30, fn: 'sin', ratio: '', answer: c };
  }
  if (mode === 'leg') {
    const given: 0 | 1 = rng() < 0.5 ? 0 : 1;
    return {
      mode,
      a,
      b,
      c,
      given,
      x0: 0,
      y0: 0,
      angle: 30,
      fn: 'sin',
      ratio: '',
      answer: given === 0 ? b : a,
    };
  }
  return { mode, a, b, c, given: 0, x0: 0, y0: 0, angle: 30, fn: 'sin', ratio: '', answer: c };
}

const cm = (v: number): string => `${fmtNumber(v)} cm`;

export function build(values: PythagorasValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, c, given, x0, y0, angle, fn, ratio, answer } = values;
  const lengthChoices = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(answer, cleanNumbers(candidates).filter((v) => v > 0), rng).map((v) => cm(v)) as [
      string,
      string,
      string,
    ];

  if (mode === 'hypotenuse') {
    const distractors = lengthChoices([Math.sqrt(a * a + b * b + 1), a + b, Math.abs(a - b) + Math.min(a, b)]);
    return {
      stem: `A right-angled triangle has shorter sides of ${fmtNumber(a)} cm and ${fmtNumber(b)} cm. What is the length of its hypotenuse?`,
      correct: cm(c),
      distractors,
      explanation: `$c^2 = ${fmtNumber(a)}^2 + ${fmtNumber(b)}^2 = ${fmtNumber(a * a + b * b)}$, so $c = \\sqrt{${fmtNumber(a * a + b * b)}} = ${fmtNumber(c)}\\text{ cm}$. The ${cm(a + b)} option adds the two sides instead.`,
    };
  }

  if (mode === 'leg') {
    const known = given === 0 ? a : b;
    const missing = given === 0 ? b : a;
    const distractors = lengthChoices([c - known, c + known, Math.abs(c - known) / 2]);
    return {
      stem: `A right-angled triangle has a hypotenuse of ${fmtNumber(c)} cm and one other side of ${fmtNumber(known)} cm. What is the length of the third side?`,
      correct: cm(missing),
      distractors,
      explanation: `Rearranged, $a^2 = c^2 - b^2 = ${fmtNumber(c)}^2 - ${fmtNumber(known)}^2 = ${fmtNumber(c * c - known * known)}$, so the third side is $\\sqrt{${fmtNumber(c * c - known * known)}} = ${fmtNumber(missing)}\\text{ cm}$.`,
    };
  }

  if (mode === 'distance') {
    // Coordinates carry no units, unlike the triangle modes.
    const units = uniqueNumericDistractors(answer, cleanNumbers([a + b, Math.abs(a - b), c + 1]).filter((v) => v > 0), rng).map(
      (v) => fmtNumber(v)
    ) as [string, string, string];
    return {
      stem: `Find the distance between the points $(${fmtNumber(x0)}, ${fmtNumber(y0)})$ and $(${fmtNumber(x0 + a)}, ${fmtNumber(y0 + b)})$.`,
      correct: fmtNumber(c),
      distractors: units,
      explanation: `The displacements are ${fmtNumber(a)} and ${fmtNumber(b)}, so the distance is $\\sqrt{${fmtNumber(a)}^2 + ${fmtNumber(b)}^2} = \\sqrt{${fmtNumber(a * a + b * b)}} = ${fmtNumber(c)}$.`,
    };
  }

  if (mode === 'trig-ratio') {
    const correct = `$${ratio}$`;
    const distractors = uniqueDistractors(
      correct,
      RATIO_POOL.filter((v) => v !== ratio).map((v) => `$${v}$`),
      RATIO_POOL.map((v) => `$${v}$`),
      rng
    );
    return {
      stem: `What is the exact value of $\\${fn} ${angle}^{\\circ}$?`,
      correct,
      distractors,
      explanation: `In the special-angle table, $\\${fn} ${angle}^{\\circ} = ${ratio}$. The other three options are the values this ratio takes at the other two special angles.`,
    };
  }

  if (mode === 'trig-side') {
    // One rule drives both directions: in a 30-60-90 triangle the shortest side is
    // half the hypotenuse, so "find the short side" halves and "find the hypotenuse"
    // doubles — never a decimal ratio.
    const hyp = fn === 'cos' ? answer : a;
    const distractors = lengthChoices([hyp, hyp * 2, hyp / 4]);
    const stem =
      fn === 'cos'
        ? `In a right-angled triangle the side adjacent to a ${fmtNumber(angle)}^{\\circ} angle is ${fmtNumber(a)} cm. What is the length of the hypotenuse?`
        : `A right-angled triangle has a hypotenuse of ${fmtNumber(a)} cm and one angle of ${fmtNumber(angle)}^{\\circ}. What is the length of the side opposite that angle?`;
    const explanation =
      fn === 'cos'
        ? `$\\cos ${angle}^{\\circ} = \\dfrac{1}{2}$, so $\\dfrac{\\text{adjacent}}{\\text{hypotenuse}} = \\dfrac{1}{2}$ and the hypotenuse is $2 \\times ${fmtNumber(a)} = ${fmtNumber(answer)}\\text{ cm}$.`
        : `$\\sin ${angle}^{\\circ} = \\dfrac{1}{2}$, so the opposite side is $\\dfrac{1}{2} \\times ${fmtNumber(a)} = ${fmtNumber(answer)}\\text{ cm}$.`;
    return { stem, correct: cm(answer), distractors, explanation };
  }

  const distractors = uniqueNumericDistractors(answer, ANGLE_CHOICES.filter((v) => v !== answer), rng).map(
    (v) => `$${fmtNumber(v)}^{\\circ}$`
  ) as [string, string, string];
  return {
    stem: `In a right-angled triangle $\\${fn} \\theta = ${ratio}$. What is the value of $\\theta$?`,
    correct: `$${fmtNumber(answer)}^{\\circ}$`,
    distractors,
    explanation: `Reading the exact-value table backwards, $\\${fn} ${fmtNumber(answer)}^{\\circ} = ${ratio}$, so $\\theta = ${fmtNumber(answer)}^{\\circ}$.`,
  };
}

export const mathPythagorasTrig: QuestionGenerator<PythagorasParams> = {
  id: 'math-pythagoras-trig',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
