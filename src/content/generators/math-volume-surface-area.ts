import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, pickDistinct, uniqueDistractors } from './utils';

// Volume and surface area of the 3-D solids the corpus covers: a cuboid, a cube, a
// triangular prism and a cylinder. Every dimension comes from the params table and
// every answer is computed, so an answer cannot disagree with its own stem; the
// prism's cross-section is filtered to an even base x height so half of it is whole,
// and the cylinder uses the corpus' `Use pi ~ 3.14` contract for exact 2 d.p.
//
// Distractors are the named errors: giving the surface area when the volume is
// asked for (and vice versa), forgetting the half in a triangular cross-section,
// using the diameter instead of the radius, and leaving out one pair of faces in a
// total surface area.

const MODES = [
  'cuboid-volume',
  'cuboid-surface',
  'prism-volume',
  'prism-surface',
  'cylinder-volume',
  'cylinder-curved',
  'cylinder-surface',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Dimensions to draw (integers). */
  values: z.array(z.number().int().min(2).max(20)).min(2),
  units: z.array(z.enum(['cm', 'm'])).min(1).default(['cm']),
  pi: z.enum(['3.14', '22/7']).default('3.14'),
});
export type VolumeSurfaceParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface VolumeSurfaceValues {
  mode: Mode;
  unit: string;
  pi: number;
  piLabel: string;
  /** cuboid: l, w, h. prism: base, triangle height, length. cylinder: radius, height. */
  dims: number[];
  answer: number;
}

const PI_LABELS: Record<VolumeSurfaceParams['pi'], { value: number; label: string }> = {
  '3.14': { value: 3.14, label: '3.14' },
  '22/7': { value: 22 / 7, label: '\\dfrac{22}{7}' },
};

/** (base, height, hypotenuse) triples with integer legs AND an integer hypotenuse. */
function pythagoreanTriples(values: readonly number[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const b of values) {
    for (const h of values) {
      const third = Math.sqrt(b * b + h * h);
      if (b !== h && Number.isInteger(third)) out.push([b, h, third]);
    }
  }
  return out;
}

export function draw(params: VolumeSurfaceParams, rng: Rng): VolumeSurfaceValues {
  // Normalise the schema defaults here too (plain objects reach draw() in tests).
  const modes = params.modes ?? [...MODES];
  const units = params.units ?? ['cm'];
  const piSetting = params.pi ?? '3.14';
  const { value: pi, label: piLabel } = PI_LABELS[piSetting];
  const unit = pick(units, rng);

  // Only FEASIBLE modes are drawn, so an unlucky seed can never throw: prism
  // surface area needs an integer hypotenuse, the cylinder needs a radius the
  // chosen pi keeps whole, and the cuboid needs three distinct dimensions.
  const triples = pythagoreanTriples(params.values);
  const radii = piSetting === '22/7' ? params.values.filter((v) => v % 7 === 0) : params.values;
  const evenPrism = params.values.some((b) => params.values.some((h) => b !== h && (b * h) % 2 === 0));
  const feasible = modes.filter((m) => {
    if (m === 'prism-surface') return triples.length > 0;
    if (m.startsWith('prism')) return evenPrism;
    if (m.startsWith('cylinder')) return radii.length >= 2;
    return params.values.length >= 3;
  });
  if (feasible.length === 0) {
    throw new Error('math-volume-surface-area: no mode is feasible for this param table — add values (or a 3-4-5 triple for prism surface area)');
  }
  const mode = pick(feasible, rng);

  if (mode.startsWith('cylinder')) {
    const radius = pick(radii, rng);
    const height = pick(
      radii.filter((v) => v !== radius),
      rng
    );
    const volume = pi * radius * radius * height;
    const curved = 2 * pi * radius * height;
    const total = curved + 2 * pi * radius * radius;
    const answer = mode === 'cylinder-volume' ? volume : mode === 'cylinder-curved' ? curved : total;
    return { mode, unit, pi, piLabel, dims: [radius, height], answer };
  }

  if (mode.startsWith('prism')) {
    // Half of base x height must be whole, so only even-product pairs are drawn;
    // the surface-area mode further needs an integer hypotenuse.
    const pairs: [number, number][] = [];
    for (const b of params.values) {
      for (const h of params.values) {
        if (mode === 'prism-surface') {
          if (triples.some(([tb, th]) => tb === b && th === h)) pairs.push([b, h]);
        } else if (b !== h && (b * h) % 2 === 0) {
          pairs.push([b, h]);
        }
      }
    }
    const [base, height] = pick(pairs, rng);
    const length = pick(
      params.values.filter((v) => v !== base && v !== height),
      rng
    );
    const endArea = (base * height) / 2;
    const volume = endArea * length;
    // Surface = two triangular ends + three rectangular faces (the two given
    // sides and the hypotenuse, which for these right-angled pairs is integral).
    const third = Math.sqrt(base * base + height * height);
    const surface = 2 * endArea + (base + height + third) * length;
    return { mode, unit, pi, piLabel, dims: [base, height, length], answer: mode === 'prism-volume' ? volume : surface };
  }

  const [l, w, h] = pickDistinct(params.values, 3, rng);
  const volume = l * w * h;
  const surface = 2 * (l * w + l * h + w * h);
  return { mode, unit, pi, piLabel, dims: [l, w, h], answer: mode === 'cuboid-volume' ? volume : surface };
}

const length = (v: number, unit: string) => `$${fmtNumber(v)}\\ \\text{${unit}}$`;
const square = (v: number, unit: string) => `$${fmtNumber(v)}\\ \\text{${unit}}^2$`;
const cube = (v: number, unit: string) => `$${fmtNumber(v)}\\ \\text{${unit}}^3$`;

export function build(values: VolumeSurfaceValues, rng: Rng): GeneratorOutput {
  const { mode, unit, pi, piLabel, answer } = values;
  const dims = values.dims;
  const isVolume = mode.includes('volume');
  const correct = isVolume ? cube(answer, unit) : square(answer, unit);

  let stem: string;
  let candidates: string[];
  let explanation: string;
  let named = '';

  if (mode.startsWith('cuboid')) {
    const [l, w, h] = dims;
    const volume = l * w * h;
    const surface = 2 * (l * w + l * h + w * h);
    stem =
      mode === 'cuboid-volume'
        ? `What is the volume of a cuboid with length ${length(l, unit)}, width ${length(w, unit)}, and height ${length(h, unit)}?`
        : `Find the surface area of a cuboid with length ${length(l, unit)}, width ${length(w, unit)}, and height ${length(h, unit)}.`;
    candidates = isVolume
      ? [square(surface, unit), cube(l + w + h, unit), cube(l * w, unit), cube(volume * 2, unit)]
      : [cube(volume, unit), square(l * w + l * h + w * h, unit), square(volume, unit), square(surface + 2 * l * w, unit)];
    named = isVolume ? `(${square(surface, unit)} is the surface area.)` : `(${cube(volume, unit)} is the volume.)`;
    explanation = isVolume
      ? `Volume $= l \\times w \\times h = ${l} \\times ${w} \\times ${h} = ${fmtNumber(answer)}\\ \\text{${unit}}^3$.`
      : `Surface area $= 2(lw + lh + wh) = 2(${l * w} + ${l * h} + ${w * h}) = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
  } else if (mode.startsWith('prism')) {
    const [base, height, len] = dims;
    const endArea = (base * height) / 2;
    const third = Math.sqrt(base * base + height * height);
    stem =
      mode === 'prism-volume'
        ? `A triangular prism has a right-angled triangle cross-section with legs ${length(base, unit)} and ${length(height, unit)}, and it is ${length(len, unit)} long. What is its volume?`
        : `A triangular prism has a right-angled triangle cross-section with legs ${length(base, unit)} and ${length(height, unit)}, and it is ${length(len, unit)} long. What is its total surface area?`;
    candidates = isVolume
      ? [cube(base * height * len, unit), cube(endArea, unit), cube((base + height) * len, unit), cube(answer * 2, unit)]
      : [
          cube(answer, unit),
          square(2 * endArea + (base + height) * len, unit),
          square((base + height) * len, unit),
          square(answer + endArea, unit),
        ];
    named = isVolume ? `(${cube(base * height * len, unit)} forgets the half.)` : '';
    explanation = isVolume
      ? `Cross-section area $= \\frac{1}{2} \\times ${base} \\times ${height} = ${fmtNumber(endArea)}\\ \\text{${unit}}^2$, then volume $= ${fmtNumber(endArea)} \\times ${len} = ${fmtNumber(answer)}\\ \\text{${unit}}^3$.`
      : `Two triangular ends: $2 \\times ${fmtNumber(endArea)} = ${fmtNumber(2 * endArea)}$. Three rectangles: $(${base} + ${height} + ${fmtNumber(third)}) \\times ${len} = ${fmtNumber((base + height + third) * len)}$. Total $= ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
  } else {
    const [radius, height] = dims;
    const volume = pi * radius * radius * height;
    const curved = 2 * pi * radius * height;
    const total = curved + 2 * pi * radius * radius;
    const diameter = 2 * radius;
    if (isVolume) {
      stem = `Find the volume of a cylinder with radius ${length(radius, unit)} and height ${length(height, unit)}. Use $\\pi \\approx ${piLabel}$.`;
      candidates = [
        cube(pi * diameter * diameter * height, unit),
        cube(pi * radius * height, unit),
        square(total, unit),
        cube(volume / 2, unit),
      ];
      named = `(${square(total, unit)} is the total surface area.)`;
      explanation = `Volume $= \\pi r^2 h = ${piLabel} \\times ${radius}^2 \\times ${height} = ${fmtNumber(answer)}\\ \\text{${unit}}^3$.`;
    } else if (mode === 'cylinder-curved') {
      stem = `Find the CURVED surface area of a cylinder with radius ${length(radius, unit)} and height ${length(height, unit)}. Use $\\pi \\approx ${piLabel}$.`;
      candidates = [square(total, unit), square(pi * radius * radius, unit), square(2 * pi * diameter * height, unit), square(curved / 2, unit)];
      named = `(${square(total, unit)} includes the two circular ends.)`;
      explanation = `Curved surface area $= 2\\pi r h = 2 \\times ${piLabel} \\times ${radius} \\times ${height} = ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
    } else {
      stem = `Find the total surface area of a closed cylinder with radius ${length(radius, unit)} and height ${length(height, unit)}. Use $\\pi \\approx ${piLabel}$.`;
      candidates = [square(curved, unit), square(pi * radius * height, unit), square(2 * pi * radius * radius, unit), cube(volume, unit)];
      named = `(${square(curved, unit)} leaves out the two circular ends.)`;
      explanation = `Curved area $= 2\\pi r h = ${fmtNumber(curved)}\\ \\text{${unit}}^2$ and the two ends add $2\\pi r^2 = ${fmtNumber(2 * pi * radius * radius)}\\ \\text{${unit}}^2$: total $= ${fmtNumber(answer)}\\ \\text{${unit}}^2$.`;
    }
  }

  const fallback = [cube(answer + 1, unit), square(answer - 1, unit), square(answer + 2, unit), cube(answer * 2, unit)];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);
  return { stem, correct, distractors, explanation: named.length > 0 ? `${explanation} ${named}` : explanation };
}

export const mathVolumeSurface: QuestionGenerator<VolumeSurfaceParams> = {
  id: 'math-volume-surface-area',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
