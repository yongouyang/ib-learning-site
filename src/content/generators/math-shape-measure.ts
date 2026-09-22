import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, pickDistinct, uniqueDistractors } from './utils';

// Perimeter and area of the KS3/IGCSE shapes: rectangle, triangle, parallelogram,
// trapezium and circle. Every dimension is drawn from the params table and every
// answer is computed, so an answer can never disagree with its own stem; the
// triangle/trapezium draws filter for an even product so the answer stays whole.
//
// Circles take the corpus' own convention — `Use \pi \approx 3.14` (exact 2 d.p.)
// or `\dfrac{22}{7}` (whole numbers, hence the r-multiple-of-7 filter). The 3 s.f.
// rounding style the other circle topic uses is deliberately NOT mixed in: one
// generator, one rounding contract.
//
// Distractors are the named errors: reaching for the perimeter when asked for the
// area (and vice versa), forgetting the half on a triangle or trapezium, using
// the slant side instead of the perpendicular height, and using r or the
// diameter where r^2 is wanted.

const SHAPES = ['rectangle', 'triangle', 'parallelogram', 'trapezium', 'circle'] as const;
const ASKS = ['area', 'perimeter', 'circumference'] as const;

export const paramsSchema = z
  .object({
    shapes: z.array(z.enum(SHAPES)).min(1),
    /** Narrow the question types; the shape decides which ones are possible. */
    asks: z.array(z.enum(ASKS)).min(1).default(['area', 'perimeter', 'circumference']),
    /** Dimensions to draw from (integers). */
    values: z.array(z.number().int().min(2).max(30)).min(2),
    units: z.array(z.enum(['cm', 'm'])).min(1).default(['cm']),
    /** Which value of pi the stem offers. */
    pi: z.enum(['3.14', '22/7']).default('3.14'),
  })
  .refine((p) => p.pi !== '22/7' || p.values.some((v) => v % 7 === 0), {
    message: 'math-shape-measure: pi = 22/7 needs a radius that is a multiple of 7 (7, 14, 21) for a whole-number answer',
  });
export type ShapeMeasureParams = z.infer<typeof paramsSchema>;

type Shape = (typeof SHAPES)[number];
type Ask = (typeof ASKS)[number];

export interface ShapeMeasureValues {
  shape: Shape;
  ask: Ask;
  unit: string;
  pi: number;
  /** Label of the pi offered in the stem. */
  piLabel: string;
  /** Rectangle: l, w. Triangle/parallelogram: base, height. Trapezium: a, b, height. Circle: r. */
  dims: number[];
  answer: number;
}

const PI_LABELS: Record<ShapeMeasureParams['pi'], { value: number; label: string }> = {
  '3.14': { value: 3.14, label: '3.14' },
  '22/7': { value: 22 / 7, label: '\\dfrac{22}{7}' },
};

function asksFor(shape: Shape, asked: readonly Ask[]): Ask[] {
  return shape === 'circle'
    ? asked.filter((a) => a === 'area' || a === 'circumference')
    : asked.filter((a) => a === 'area' || a === 'perimeter');
}

export function draw(params: ShapeMeasureParams, rng: Rng): ShapeMeasureValues {
  // Only shapes with a possible question type are drawn, so a mixed table can
  // never throw at runtime on an unlucky seed — validation catches the case
  // where NO listed shape is askable.
  // Normalise the schema defaults here too — draw() is called with a plain object
  // by unit tests and future callers.
  const asked = params.asks ?? ['area', 'perimeter', 'circumference'];
  const units = params.units ?? ['cm'];
  const piSetting = params.pi ?? '3.14';
  const usable = params.shapes.filter((shape) => asksFor(shape, asked).length > 0);
  if (usable.length === 0) {
    throw new Error(
      'math-shape-measure: asks has no question type for any listed shape — add "area"/"perimeter"/"circumference", or drop the shape'
    );
  }
  const shape = pick(usable, rng);
  const ask = pick(asksFor(shape, asked), rng);
  const { value: pi, label: piLabel } = PI_LABELS[piSetting];
  const unit = pick(units, rng);

  if (shape === 'circle') {
    const radii = piSetting === '22/7' ? params.values.filter((v) => v % 7 === 0) : params.values;
    const r = pick(radii, rng);
    return {
      shape,
      ask,
      unit,
      pi,
      piLabel,
      dims: [r],
      answer: ask === 'area' ? pi * r * r : 2 * pi * r,
    };
  }

  if (shape === 'rectangle') {
    const [l, w] = pickDistinct(params.values, 2, rng);
    return { shape, ask, unit, pi, piLabel, dims: [l, w], answer: ask === 'area' ? l * w : 2 * (l + w) };
  }

  if (shape === 'triangle') {
    // Half of base x height must be whole, so only even-product pairs are drawn.
    const [b, h] = pick(pairsWithEvenProduct(params.values), rng);
    return { shape, ask, unit, pi, piLabel, dims: [b, h], answer: (b * h) / 2 };
  }

  if (shape === 'parallelogram') {
    const [b, h] = pickDistinct(params.values, 2, rng);
    return { shape, ask, unit, pi, piLabel, dims: [b, h], answer: b * h };
  }

  // trapezium: two parallel sides and the perpendicular height
  const [a, b] = pickDistinct(params.values, 2, rng);
  const heights = params.values.filter((v) => ((a + b) * v) % 2 === 0);
  if (heights.length === 0) {
    throw new Error('math-shape-measure: no height gives a whole trapezium area — add an even value to the param table');
  }
  const h = pick(heights, rng);
  return { shape, ask, unit, pi, piLabel, dims: [a, b, h], answer: ((a + b) * h) / 2 };
}

/** Distinct (base, height) pairs whose product is even, so the triangle area is whole. */
function pairsWithEvenProduct(values: readonly number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (const b of values) {
    for (const h of values) {
      if (b !== h && (b * h) % 2 === 0) pairs.push([b, h]);
    }
  }
  if (pairs.length === 0) {
    throw new Error('math-shape-measure: no base/height pair gives a whole triangle area — add an even value to the param table');
  }
  return pairs;
}

function length(value: number, unit: string): string {
  return `$${fmtNumber(value)}\\ \\text{${unit}}$`;
}

function area(value: number, unit: string): string {
  return `$${fmtNumber(value)}\\ \\text{${unit}}^2$`;
}

export function build(values: ShapeMeasureValues, rng: Rng): GeneratorOutput {
  const { shape, ask, unit, piLabel, answer } = values;
  const dims = values.dims;
  const isArea = ask === 'area';
  const correct = isArea ? area(answer, unit) : length(answer, unit);

  let stem: string;
  let candidates: string[];
  let explanation: string;
  let named = '';

  if (shape === 'rectangle') {
    const [l, w] = dims;
    stem = isArea
      ? `What is the area of a rectangle measuring ${length(l, unit)} by ${length(w, unit)}?`
      : `What is the perimeter of a rectangle with length ${length(l, unit)} and width ${length(w, unit)}?`;
    candidates = isArea
      ? [length(2 * (l + w), unit), length(l + w, unit), area(l * w + l, unit), area(l * w + w, unit)]
      : [area(l * w, unit), length(l + w, unit), area(2 * l * w, unit), length(2 * (l + w) + 2, unit)];
    if (!isArea) named = `(${area(l * w, unit)} is the area.)`;
    if (isArea) named = `${length(2 * (l + w), unit)} is the perimeter`;
    explanation = isArea
      ? `Area of a rectangle = length × width: $${l} \\times ${w} = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`
      : `Perimeter of a rectangle $= 2(l + w) = 2(${l} + ${w}) = ${fmtNumber(answer)}\\ \\text{${unit}}$.`;
  } else if (shape === 'triangle') {
    const [b, h] = dims;
    const product = b * h;
    stem = `A triangle has base ${length(b, unit)} and perpendicular height ${length(h, unit)}. What is its area?`;
    candidates = [
      area(product, unit),
      length(b + h, unit),
      area(product / 2 + b, unit),
      area(product * 2, unit),
    ];
    named = `(${area(product, unit)} is base × height without the half.)`;
    explanation = `Area of a triangle $= \\frac{1}{2} \\times \\text{base} \\times \\text{height} = \\frac{1}{2} \\times ${b} \\times ${h} = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
  } else if (shape === 'parallelogram') {
    const [b, h] = dims;
    stem = `A parallelogram has base ${length(b, unit)} and perpendicular height ${length(h, unit)}. What is its area?`;
    candidates = [
      area((b * h) / 2, unit),
      length(b + h, unit),
      length(2 * (b + h), unit),
      area(b * h + b, unit),
    ];
    named = `(${area((b * h) / 2, unit)} is the triangle formula.)`;
    explanation = `Area of a parallelogram $= \\text{base} \\times \\text{perpendicular height} = ${b} \\times ${h} = ${fmtNumber(answer)}\\ \\text{${unit}}^2$. The slant side is not the height.`;
  } else if (shape === 'trapezium') {
    const [a, b, h] = dims;
    stem = `A trapezium has parallel sides of ${length(a, unit)} and ${length(b, unit)}, and a perpendicular height of ${length(h, unit)}. What is its area?`;
    candidates = [
      area((a + b) * h, unit),
      area(a * b * h, unit),
      length(a + b + h, unit),
      area(((a + b) * h) / 2 + h, unit),
    ];
    named = `(${area((a + b) * h, unit)} is (a + b)h without the half.)`;
    explanation = `Area of a trapezium $= \\frac{1}{2}(a + b)h = \\frac{1}{2}(${a} + ${b}) \\times ${h} = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
  } else {
    const [r] = dims;
    const areaValue = values.pi * r * r;
    const circumference = 2 * values.pi * r;
    if (isArea) {
      stem = `Find the area of a circle with radius ${length(r, unit)}. Use $\\pi \\approx ${piLabel}$.`;
      candidates = [
        length(circumference, unit),
        area(values.pi * r, unit),
        area(values.pi * (2 * r) ** 2, unit),
        area(areaValue + values.pi * r, unit),
      ];
      named = `(${length(circumference, unit)} is the circumference.)`;
      explanation = `Area $= \\pi r^2 = ${piLabel === '3.14' ? '3.14' : `\\frac{22}{7}`} \\times ${r}^2 = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
    } else {
      stem = `Find the circumference of a circle with radius ${length(r, unit)}. Use $\\pi \\approx ${piLabel}$.`;
      candidates = [
        area(areaValue, unit),
        length(values.pi * r, unit),
        length(4 * values.pi * r, unit),
        length(circumference + values.pi, unit),
      ];
      named = `(${area(areaValue, unit)} is the area.)`;
      explanation = `Circumference $= 2\\pi r = 2 \\times ${piLabel === '3.14' ? '3.14' : `\\frac{22}{7}`} \\times ${r} = ${fmtNumber(answer)}\\ \\text{${unit}}$.`;
    }
  }

  const fallback = [
    length(answer + 1, unit),
    length(answer - 1, unit),
    area(answer + 2, unit),
    length(answer * 2, unit),
  ];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);
  return {
    stem,
    correct,
    distractors,
    explanation: named.length > 0 ? `${explanation} ${named}` : explanation,
  };
}

export const mathShapeMeasure: QuestionGenerator<ShapeMeasureParams> = {
  id: 'math-shape-measure',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
