import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Metric (and two imperial) conversions: mass, length, area, volume, time, and the two
// approximations the syllabus fixes (1 mile ≈ 1.6 km, 1 lb ≈ 0.45 kg). Nothing here is
// computed from a float: the conversions are integer multiplications and divisions by a
// power of ten, the time mode works in whole minutes, and the tank mode divides cm³ by 1000.
// A conversion whose result would not print cleanly (a recurring pound-to-kilogram) is not
// drawn, so every choice is a value the params table can state exactly.
//
// Distractors are the named errors: converting in the wrong direction, using 100 instead of
// 10 000 for an area, reading cm³ as litres without the 1000, and treating the minutes left
// over as a decimal (0.2 h read as 20 minutes is right; 140 minutes read as 1.40 h is not).

const MODES = [
  'kg-to-g',
  'm-to-km',
  'cm-to-mm',
  'm2-to-cm2',
  'cm3-to-litres',
  'hours-to-minutes',
  'minutes-to-hours-minutes',
  'tank-litres',
  'miles-to-km',
  'kg-to-lb',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Masses in kg. */
  kgs: z.array(z.number().min(0.1).max(20)).min(1),
  /** Distances in metres. */
  metres: z.array(z.number().int().min(100).max(20000)).min(1),
  /** Lengths in cm. */
  cms: z.array(z.number().int().min(2).max(200)).min(1),
  /** Areas in m². */
  squareMetres: z.array(z.number().int().min(1).max(50)).min(1),
  /** Volumes in cm³. */
  cubicCms: z.array(z.number().int().min(100).max(50000)).min(1),
  /** Durations in hours. */
  hours: z.array(z.number().int().min(1).max(12)).min(1),
  /** Durations in minutes (the hours-and-minutes mode). */
  minutes: z.array(z.number().int().min(60).max(600)).min(1),
  /** Tank dimensions in cm, given as [length, width, height]. */
  tanks: z
    .array(
      z.tuple([
        z.number().int().min(5).max(60),
        z.number().int().min(5).max(60),
        z.number().int().min(2).max(60),
      ])
    )
    .min(1),
  /** Distances in miles. */
  miles: z.array(z.number().min(1).max(50)).min(1),
});
export type MeasuresParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface MeasuresValues {
  mode: Mode;
  /** The value being converted (a mass, a length, a volume, a duration …). */
  value: number;
  /** Second and third operands for the two-shape modes (tank dimensions, hours/minutes). */
  b: number;
  c: number;
  /** The printed correct choice (carries its unit). */
  answer: string;
  /** The numeric answer (a count of hours for the minutes mode, so NaN where the answer is a string). */
  answerValue: number;
}

const EMPTY: Omit<MeasuresValues, 'mode' | 'answer' | 'answerValue'> = { value: 0, b: 0, c: 0 };

export function draw(params: MeasuresParams, rng: Rng): MeasuresValues {
  const modes = params.modes ?? [...MODES];
  const kgs = params.kgs;
  const metres = params.metres;
  const cms = params.cms;
  const squareMetres = params.squareMetres;
  const cubicCms = params.cubicCms;
  const hours = params.hours;
  const minutes = params.minutes;
  const tanks = params.tanks;
  const miles = params.miles;

  const exact = (v: number): boolean => cleanNumbers([v]).length === 1;
  const feasible = modes.filter((mode) => {
    if (mode === 'kg-to-g') return kgs.length > 0;
    if (mode === 'cm-to-mm') return cms.length > 0;
    if (mode === 'm2-to-cm2') return squareMetres.length > 0;
    if (mode === 'cm3-to-litres') return cubicCms.length > 0;
    if (mode === 'hours-to-minutes') return hours.length > 0;
    if (mode === 'minutes-to-hours-minutes') return minutes.some((m) => m >= 60);
    if (mode === 'tank-litres') return tanks.some(([l, w, h]) => exact((l * w * h) / 1000));
    if (mode === 'miles-to-km') return miles.some((m) => exact(m * 1.6));
    if (mode === 'kg-to-lb') return kgs.some((kg) => exact(kg / 0.45));
    return metres.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-measures: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const withUnit = (value: number, unit: string): MeasuresValues => ({
    ...EMPTY,
    mode,
    value,
    answer: `$${fmtNumber(value)}$ ${unit}`,
    answerValue: value,
  });

  if (mode === 'kg-to-g') {
    const kg = pick(kgs, rng);
    return withUnit(kg * 1000, 'g');
  }

  if (mode === 'm-to-km') {
    const m = pick(metres, rng);
    return withUnit(m / 1000, 'km');
  }

  if (mode === 'cm-to-mm') {
    const cm = pick(cms, rng);
    return withUnit(cm * 10, 'mm');
  }

  if (mode === 'm2-to-cm2') {
    const m2 = pick(squareMetres, rng);
    return withUnit(m2 * 10000, 'cm²');
  }

  if (mode === 'cm3-to-litres') {
    const cm3 = pick(cubicCms, rng);
    return withUnit(cm3 / 1000, 'l');
  }

  if (mode === 'hours-to-minutes') {
    const h = pick(hours, rng);
    return withUnit(h * 60, 'min');
  }

  if (mode === 'minutes-to-hours-minutes') {
    const total = pick(minutes.filter((m) => m >= 60), rng);
    const h = Math.floor(total / 60);
    const rest = total % 60;
    return {
      ...EMPTY,
      mode,
      value: total,
      b: h,
      c: rest,
      answer: `$${fmtNumber(h)}$ hours $${fmtNumber(rest)}$ minutes`,
      answerValue: NaN,
    };
  }

  if (mode === 'tank-litres') {
    const [l, w, h] = pick(tanks.filter(([a, b2, c2]) => exact((a * b2 * c2) / 1000)), rng);
    return { ...withUnit((l * w * h) / 1000, 'l'), mode, value: l, b: w, c: h };
  }

  if (mode === 'miles-to-km') {
    const m = pick(miles.filter((v) => exact(v * 1.6)), rng);
    return withUnit(m * 1.6, 'km');
  }

  const kg = pick(kgs.filter((v) => exact(v / 0.45)), rng);
  return withUnit(kg / 0.45, 'lb');
}

export function build(values: MeasuresValues, rng: Rng): GeneratorOutput {
  const { mode, value, b, c, answer } = values;
  const numeric = (candidates: number[], unit: string): [string, string, string] =>
    uniqueNumericDistractors(values.answerValue, cleanNumbers(candidates), rng).map(
      (v) => `$${fmtNumber(v)}$ ${unit}`
    ) as [string, string, string];

  if (mode === 'kg-to-g') {
    return {
      stem: `Convert $${fmtNumber(value / 1000)}\\text{ kg}$ to grams.`,
      correct: answer,
      distractors: numeric([value / 10, value * 10, value / 1000], 'g'),
      explanation: `There is $1000$ g in a kg, so multiply: $${fmtNumber(value / 1000)} \\times 1000 = ${fmtNumber(
        value
      )}$ g. Leaving the number as $${fmtNumber(value / 1000)}$ — the mass in kilograms — is the common slip.`,
    };
  }

  if (mode === 'm-to-km') {
    const metres = value * 1000;
    return {
      stem: `Convert $${fmtNumber(metres)}\\text{ m}$ to kilometres.`,
      correct: answer,
      distractors: numeric([value * 10, value / 10, value * 1000], 'km'),
      explanation: `There are $1000$ m in a km, so divide: $${fmtNumber(metres)} \\div 1000 = ${fmtNumber(
        value
      )}$ km. Reading the same number as kilometres without dividing would give $${fmtNumber(metres)}$ km, a thousand times too long.`,
    };
  }

  if (mode === 'cm-to-mm') {
    return {
      stem: `How many millimetres are in $${fmtNumber(value / 10)}\\text{ cm}$?`,
      correct: answer,
      distractors: numeric([value / 10, value * 100, value / 100], 'mm'),
      explanation: `Each centimetre is $10$ mm, so $${fmtNumber(value / 10)} \\times 10 = ${fmtNumber(value)}$ mm.`,
    };
  }

  if (mode === 'm2-to-cm2') {
    const m2 = value / 10000;
    return {
      stem: `Convert $${fmtNumber(m2)}\\text{ m}^2$ to square centimetres.`,
      correct: answer,
      distractors: numeric([m2 * 100, m2 * 1000, m2 * 100000, value / 100], 'cm²'),
      explanation: `An area needs the conversion applied to BOTH dimensions: $100 \\times 100 = 10\\,000$ cm² in a m². So $${fmtNumber(
        m2
      )} \\times 10\\,000 = ${fmtNumber(value)}$ cm². Using $100$ would give $${fmtNumber(m2 * 100)}$ cm².`,
    };
  }

  if (mode === 'cm3-to-litres') {
    const cm3 = value * 1000;
    return {
      stem: `Convert $${fmtNumber(cm3)}\\text{ cm}^3$ to litres.`,
      correct: answer,
      distractors: numeric([value * 10, value / 10, value * 1000], 'l'),
      explanation: `There are $1000$ cm³ in a litre, so $${fmtNumber(cm3)} \\div 1000 = ${fmtNumber(value)}$ l. A cm³ is a millilitre, so $${fmtNumber(cm3)}$ millilitres is $${fmtNumber(value)}$ litres.`,
    };
  }

  if (mode === 'hours-to-minutes') {
    return {
      stem: `How many minutes are in $${fmtNumber(value / 60)}\\text{ hours}$?`,
      correct: answer,
      distractors: numeric([value / 60, value / 60 * 100, value * 6], 'min'),
      explanation: `Each hour is $60$ minutes: $${fmtNumber(value / 60)} \\times 60 = ${fmtNumber(value)}$ min.`,
    };
  }

  if (mode === 'minutes-to-hours-minutes') {
    const candidates = [
      `$${fmtNumber(c)}$ hours $${fmtNumber(b)}$ minutes`,
      `$${fmtNumber(b + 1)}$ hours $${fmtNumber(c)}$ minutes`,
      `$${fmtNumber(b)}$ hours $${fmtNumber(c + 5)}$ minutes`,
      `$${fmtNumber(value / 100)}$ hours`,
    ];
    return {
      stem: `A journey lasts $${fmtNumber(value)}$ minutes. How many hours and minutes is this?`,
      correct: answer,
      distractors: uniqueDistractors(answer, candidates, ['$1$ hours $0$ minutes', '$2$ hours $0$ minutes'], rng),
      explanation: `$${fmtNumber(value)} \\div 60 = ${fmtNumber(b)}$ remainder $${fmtNumber(
        c
      )}$, so the journey is $${fmtNumber(b)}$ hours and $${fmtNumber(c)}$ minutes. Writing $${fmtNumber(value)}$ minutes as $${fmtNumber(
        value / 100
      )}$ hours would be wrong — minutes are not hundredths of an hour.`,
    };
  }

  if (mode === 'tank-litres') {
    const volume = value * b * c;
    return {
      stem: `A tank measures $${fmtNumber(value)}$ cm by $${fmtNumber(b)}$ cm by $${fmtNumber(c)}$ cm. How many litres does it hold?`,
      correct: answer,
      distractors: numeric([volume, volume / 100, volume / 10000, volume / 1000 / 10], 'l'),
      explanation: `Volume $= ${fmtNumber(value)} \\times ${fmtNumber(b)} \\times ${fmtNumber(c)} = ${fmtNumber(
        volume
      )}$ cm³. There are $1000$ cm³ in a litre, so the tank holds $${fmtNumber(volume)} \\div 1000 = ${fmtNumber(values.answerValue)}$ l — $${fmtNumber(volume)}$ litres would be a thousand times too much.`,
    };
  }

  if (mode === 'miles-to-km') {
    const miles = value / 1.6;
    return {
      stem: `Convert $${fmtNumber(miles)}\\text{ miles}$ to kilometres, using $1\\text{ mile} \\approx 1.6\\text{ km}$.`,
      correct: answer,
      distractors: numeric([miles / 1.6, value * 1.6 * 10, miles + 1.6, value / 1.6], 'km'),
      explanation: `One mile is about $1.6$ km, so multiply: $${fmtNumber(miles)} \\times 1.6 = ${fmtNumber(
        value
      )}$ km. Dividing by $1.6$ would make the distance in km smaller than the distance in miles, which cannot be right.`,
    };
  }

  const kg = value * 0.45;
  return {
    stem: `Convert $${fmtNumber(kg)}\\text{ kg}$ to pounds, using $1\\text{ lb} \\approx 0.45\\text{ kg}$.`,
    correct: answer,
    distractors: numeric([kg * 0.45, value * 0.45, value + 0.45, value / 0.45 / 10], 'lb'),
    explanation: `A pound is about $0.45$ kg, so a kilogram is heavier than a pound and the number must get bigger: $${fmtNumber(
      kg
    )} \\div 0.45 = ${fmtNumber(value)}$ lb. Multiplying by $0.45$ instead would make the answer smaller than the mass in kg, which cannot be right.`,
  };
}

export const mathMeasures: QuestionGenerator<MeasuresParams> = {
  id: 'math-measures',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
