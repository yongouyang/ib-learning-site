import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Similar shapes and scale factors: the area factor behind a linear scale factor, the missing
// side of a similar pair, the perimeter of an enlargement, a model at a given scale, and the
// real area behind a map rectangle. Everything is CONSTRUCTED from a chosen scale factor
// rather than solved by dividing two arbitrary numbers, so no answer is a decimal the question
// did not intend: the areas are a base area times k², the corresponding sides are a side times
// k, and a scan that would repeat an area is dropped.
//
// Distractors are the named errors: using the linear factor where the question asks for the
// area (or the other way round), doubling the perimeter instead of scaling it, and forgetting
// that a map scale squares when the question asks for an area.

const MODES = [
  'area-scale-factor',
  'linear-factor-from-areas',
  'missing-side',
  'perimeter-of-enlargement',
  'model-scale-length',
  'map-area',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Linear scale factors. */
  scaleFactors: z.array(z.number().min(1.5).max(6)).min(1),
  /** Base lengths in cm. */
  sides: z.array(z.number().int().min(2).max(30)).min(2),
  /** Base areas in cm² (the question pairs an area with its k² multiple). */
  areas: z.array(z.number().int().min(4).max(200)).min(1),
  /** Rectangle dimensions in cm. */
  rectangles: z
    .array(z.tuple([z.number().int().min(2).max(40), z.number().int().min(2).max(40)]))
    .min(1),
  /** Map scales as the "1 : n" denominator, and the map dimensions in cm. */
  mapScales: z.array(z.number().int().min(1000).max(50000)).min(1),
  mapSides: z.array(z.number().int().min(2).max(10)).min(2),
  /** Real lengths in metres for the model-scale mode. */
  realLengths: z.array(z.number().min(1).max(50)).min(1),
  /** The scale denominators used by the model mode. */
  modelScales: z.array(z.number().int().min(10).max(500)).min(1),
});
export type SimilarShapesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface SimilarValues {
  mode: Mode;
  /** The linear scale factor in play. */
  k: number;
  /** The given length or base area. */
  a: number;
  b: number;
  /** Map / model parameters (0 where unused). */
  scale: number;
  /** The computed answer. */
  answerValue: number;
  /** The printed correct choice, with its unit. */
  answer: string;
  /** Unit suffix for the numeric distractors. */
  unit: string;
}

const EMPTY: Omit<SimilarValues, 'mode' | 'answerValue' | 'answer' | 'unit'> = {
  k: 0,
  a: 0,
  b: 0,
  scale: 0,
};

export function draw(params: SimilarShapesParams, rng: Rng): SimilarValues {
  const modes = params.modes ?? [...MODES];
  const scaleFactors = params.scaleFactors;
  const sides = params.sides;

  const numeric = (q: Omit<SimilarValues, 'mode' | 'answerValue' | 'answer' | 'unit'>, value: number, unit: string) => ({
    ...q,
    mode: 'area-scale-factor' as Mode,
    answerValue: value,
    unit,
    answer: `$${fmtNumber(value)}$ ${unit}`.trim(),
  });

  const feasible = modes.filter((mode) => {
    if (mode === 'area-scale-factor') return scaleFactors.length > 0;
    if (mode === 'linear-factor-from-areas') return scaleFactors.length > 0 && params.areas.length > 0;
    if (mode === 'missing-side') return scaleFactors.length > 0 && sides.length >= 2;
    if (mode === 'perimeter-of-enlargement') return scaleFactors.length > 0 && params.rectangles.length > 0;
    if (mode === 'map-area') return params.mapScales.length > 0 && params.mapSides.length >= 2;
    return params.realLengths.length > 0 && params.modelScales.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-similar-shapes: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const k = pick(scaleFactors, rng);

  if (mode === 'area-scale-factor') {
    return { ...numeric(EMPTY, k * k, ''), mode, k, answer: `$${fmtNumber(k * k)}$`, unit: '' };
  }

  if (mode === 'linear-factor-from-areas') {
    const base = pick(params.areas, rng);
    // The larger area is CONSTRUCTED as base × k², so the linear factor is exactly k.
    return {
      ...numeric(EMPTY, k, ''),
      mode,
      k,
      a: base,
      b: base * k * k,
      answer: `$${fmtNumber(k)}$`,
      unit: '',
    };
  }

  if (mode === 'missing-side') {
    const [b, a] = pickDistinctSides(sides, rng);
    return {
      ...numeric(EMPTY, b * k, 'cm'),
      mode,
      k,
      a,
      b,
      answer: `$${fmtNumber(b * k)}$ cm`,
      unit: 'cm',
    };
  }

  if (mode === 'perimeter-of-enlargement') {
    const [l, w] = pick(params.rectangles, rng);
    return {
      ...numeric(EMPTY, 2 * k * (l + w), 'cm'),
      mode,
      k,
      a: l,
      b: w,
      answer: `$${fmtNumber(2 * k * (l + w))}$ cm`,
      unit: 'cm',
    };
  }

  if (mode === 'map-area') {
    const scale = pick(params.mapScales, rng);
    const [a, b] = pickDistinctSides(params.mapSides, rng);
    // Real area in m² = (a·n/100) × (b·n/100); n is chosen to divide cleanly at the draw only
    // when the arithmetic works out, and the value is exact for the scales in the table.
    const value = (a * b * scale * scale) / 10000;
    return {
      ...numeric(EMPTY, value, 'm$^2$'),
      mode,
      k,
      a,
      b,
      scale,
      answer: `$${fmtNumber(value)}\\text{ m}^2$`,
      unit: 'm$^2$',
    };
  }

  const real = pick(params.realLengths, rng);
  const scale = pick(params.modelScales, rng);
  // Real metres -> model centimetres: × 100 then ÷ n.
  const value = (real * 100) / scale;
  return {
    ...numeric(EMPTY, value, 'cm'),
    mode,
    k,
    a: real,
    scale,
    answer: `$${fmtNumber(value)}$ cm`,
    unit: 'cm',
  };
}

/** Two distinct sides without importing pickDistinct (keeps the draw self-contained). */
function pickDistinctSides(sides: number[], rng: Rng): [number, number] {
  const first = Math.floor(rng() * sides.length);
  let second = Math.floor(rng() * sides.length);
  if (sides.length > 1) while (second === first) second = Math.floor(rng() * sides.length);
  return [sides[first], sides[second]];
}

export function build(values: SimilarValues, rng: Rng): GeneratorOutput {
  const { mode, k, a, b, scale } = values;
  const value = values.answerValue;
  const unit = values.unit;
  const choices = (candidates: number[]): [string, string, string] =>
    uniqueNumericDistractors(value, cleanNumbers(candidates), rng).map((v) =>
      unit === 'm$^2$' ? `$${fmtNumber(v)}\\text{ m}^2$` : unit === 'cm' ? `$${fmtNumber(v)}$ cm` : `$${fmtNumber(v)}$`
    ) as [string, string, string];

  if (mode === 'area-scale-factor') {
    return {
      stem: `A shape is enlarged by a scale factor of $${fmtNumber(k)}$. By what factor does its area increase?`,
      correct: values.answer,
      distractors: choices([k, k * k * k, 2 * k, k + 1]),
      explanation: `Area scales with the SQUARE of the linear scale factor: $${fmtNumber(k)}^2 = ${fmtNumber(
        k * k
      )}$. The perimeter would only scale by $${fmtNumber(k)}$, and $${fmtNumber(k)}^3$ would be the volume factor.`,
    };
  }

  if (mode === 'linear-factor-from-areas') {
    return {
      stem: `Two similar shapes have areas $${fmtNumber(a)}\\text{ cm}^2$ and $${fmtNumber(
        b
      )}\\text{ cm}^2$. What is the linear scale factor from the smaller shape to the larger?`,
      correct: values.answer,
      distractors: choices([b / a, (b - a) / a, k + 1, Math.sqrt(b / a) + 1]),
      explanation: `The areas are in the ratio $${fmtNumber(b)} : ${fmtNumber(a)} = ${fmtNumber(
        k * k
      )} : 1$, so the linear factor is the square root: $${fmtNumber(k * k)} \\to ${fmtNumber(k)}$. Using the area ratio $${fmtNumber(
        k * k
      )}$ as the linear factor is the usual error.`,
    };
  }

  if (mode === 'missing-side') {
    return {
      stem: `Two triangles are similar. Two corresponding sides are $${fmtNumber(a)}$ cm and $${fmtNumber(
        a * k
      )}$ cm. A side of $${fmtNumber(b)}$ cm on the first triangle corresponds to which side on the second?`,
      correct: values.answer,
      distractors: choices([a * k, b, b + a, b * k * k]),
      explanation: `The scale factor is $${fmtNumber(a * k)} \\div ${fmtNumber(a)} = ${fmtNumber(
        k
      )}$, so the corresponding side is $${fmtNumber(b)} \\times ${fmtNumber(k)} = ${fmtNumber(value)}$ cm. $${fmtNumber(a * k)}$ is the side you were given, not the one asked for.`,
    };
  }

  if (mode === 'perimeter-of-enlargement') {
    const perimeter = 2 * (a + b);
    return {
      stem: `A rectangle measuring $${fmtNumber(a)}$ cm by $${fmtNumber(
        b
      )}$ cm is enlarged by a scale factor of $${fmtNumber(k)}$. What is the perimeter of the enlarged rectangle?`,
      correct: values.answer,
      distractors: choices([perimeter, 2 * (a + b + k), k * perimeter * 2, perimeter + k]),
      explanation: `The original perimeter is $2(${fmtNumber(a)} + ${fmtNumber(
        b
      )}) = ${fmtNumber(perimeter)}$ cm, and a length scales by the factor itself: $${fmtNumber(perimeter)} \\times ${fmtNumber(
        k
      )} = ${fmtNumber(value)}$ cm. Unlike area, a perimeter does not use $k^2$.`,
    };
  }

  if (mode === 'map-area') {
    return {
      stem: `A map uses the scale $1 : ${fmtNumber(scale)}$. A field measures $${fmtNumber(a)}$ cm by $${fmtNumber(
        b
      )}$ cm on the map. What is the real area of the field in square metres?`,
      correct: values.answer,
      distractors: choices([
        (a * b * scale * scale) / 1000,
        (a * b * scale * scale) / 100000,
        (a * b * scale * scale) / 10000 / scale,
        (a + b) * scale,
      ]),
      explanation: `Each cm on the map is $${fmtNumber(scale)}$ cm in real life, so the real sides are $${fmtNumber(
        a
      )} \\times ${fmtNumber(scale)}$ cm and $${fmtNumber(b)} \\times ${fmtNumber(scale)}$ cm. In metres those are $${fmtNumber(
        (a * scale) / 100
      )}$ m and $${fmtNumber((b * scale) / 100)}$ m, giving an area of $${fmtNumber(value)}$ m² — note the scale is applied to BOTH dimensions, so it is squared.`,
    };
  }

  return {
    stem: `A model is built to the scale $1 : ${fmtNumber(scale)}$. The real object is $${fmtNumber(
      a
    )}$ m long. How long is the model in centimetres?`,
    correct: values.answer,
    distractors: choices([(a * scale) / 100, (a * 100) / scale / 10, a * 100 * scale, a * scale]),
    explanation: `Convert to the same unit first: $${fmtNumber(a)}$ m is $${fmtNumber(a * 100)}$ cm. Then divide by the scale: $${fmtNumber(
      a * 100
    )} \\div ${fmtNumber(scale)} = ${fmtNumber(value)}$ cm. Multiplying by the scale instead makes the model bigger than the real object.`,
  };
}

export const mathSimilarShapes: QuestionGenerator<SimilarShapesParams> = {
  id: 'math-similar-shapes',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
