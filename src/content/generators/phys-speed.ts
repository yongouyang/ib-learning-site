import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors } from './utils';

// Average speed: v = s / t. The most repeated calculation in physics across the
// corpus (forces, pressure, simple machines, energy, working scientifically), so
// one generator serves several hosts.
//
// Units come from the params table rather than being hard-coded: distanceUnit +
// timeUnit determine both the stem and the answer's unit, so a topic can ask for
// m/s (a runner) or km/h (a car) from the same generator. Params should pair
// distances with times that divide cleanly — the draw throws rather than emit a
// 7/3 m/s answer.

export const paramsSchema = z
  .object({
    distances: z.array(z.number().positive()).min(1),
    times: z.array(z.number().positive()).min(1),
    /** Distance unit in the stem; pairs with timeUnit to fix the answer's unit. */
    distanceUnit: z.enum(['m', 'km']).default('m'),
    timeUnit: z.enum(['s', 'h']).default('s'),
  })
  .refine(
    (p) =>
      (p.distanceUnit === 'm' && p.timeUnit === 's') ||
      (p.distanceUnit === 'km' && p.timeUnit === 'h'),
    { message: 'phys-speed: use m with s, or km with h' },
  );
export type SpeedParams = z.infer<typeof paramsSchema>;

export interface SpeedValues {
  distance: number;
  time: number;
  speed: number;
  distanceUnit: 'm' | 'km';
  timeUnit: 's' | 'h';
  /** Answer unit, e.g. "m/s". */
  speedUnit: string;
  scenario: string;
}

// Scenarios are paired with the unit AND filtered by the speed actually drawn, so
// the numbers stay believable: no runner travelling 120 km in 2 h, and no swimmer
// crossing a pool at 50 m/s. Each entry is [name, max plausible speed].
const SCENARIOS: Record<string, [string, number][]> = {
  'm/s': [
    ['A walker', 3],
    ['A swimmer', 3],
    ['A runner', 12],
    ['A cyclist', 15],
    ['A bus', 30],
    ['A train', Infinity],
  ],
  'km/h': [
    ['A lorry', 60],
    ['A bus', 80],
    ['A car', 130],
    ['A train', Infinity],
  ],
};

/** True when the quotient is exact to at most two decimal places. */
function isClean(speed: number): boolean {
  const scaled = speed * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9 && speed > 0;
}

export function draw(params: SpeedParams, rng: Rng): SpeedValues {
  // Normalise here as well as in the zod schema: `generate()` always parses
  // first, but tests and future callers invoke draw() with a plain object, and a
  // missing default silently produced "covers 60 undefined in 20 undefined".
  const distanceUnit = params.distanceUnit ?? 'm';
  const timeUnit = params.timeUnit ?? 's';
  const speedUnit = `${distanceUnit}/${timeUnit}`;
  const pairs: [number, number][] = [];
  for (const d of params.distances) {
    for (const t of params.times) {
      if (isClean(d / t)) pairs.push([d, t]);
    }
  }
  if (pairs.length === 0) {
    throw new Error(
      'phys-speed: no distance/time pair divides cleanly (needs an exact value to at most 2 d.p.)',
    );
  }
  const [distance, time] = pick(pairs, rng);
  const speed = distance / time;
  const plausible = (SCENARIOS[speedUnit] ?? [['A vehicle', Infinity] as [string, number]])
    .filter(([, max]) => speed <= max)
    .map(([name]) => name);
  const scenario = pick(plausible.length > 0 ? plausible : ['A vehicle'], rng);
  return {
    distance,
    time,
    speed,
    distanceUnit,
    timeUnit,
    speedUnit,
    scenario,
  };
}

export function build(values: SpeedValues, rng: Rng): GeneratorOutput {
  const { distance, time, speed, distanceUnit, timeUnit, speedUnit, scenario } = values;
  const correct = `${fmtNumber(speed)} ${speedUnit}`;

  // Error rules, in order of how likely a student is to make them: multiplying
  // instead of dividing, then factor-of-ten place-value slips. The inverted
  // quotient (t/d) was tried and dropped — for these magnitudes it lands at
  // 0.008 km/h, which nobody would ever choose and which wastes a distractor slot.
  const multiplied = `${fmtNumber(distance * time)} ${speedUnit}`;
  const candidates = [
    multiplied,
    `${fmtNumber(speed * 10)} ${speedUnit}`,
    `${fmtNumber(speed / 10)} ${speedUnit}`,
    `${fmtNumber(speed * 2)} ${speedUnit}`,
    `${fmtNumber(speed / 2)} ${speedUnit}`,
  ];
  const fallback = [
    `${fmtNumber(distance + time)} ${speedUnit}`,
    `${fmtNumber(Math.abs(distance - time))} ${speedUnit}`,
    `${fmtNumber(speed * 3)} ${speedUnit}`,
    `${fmtNumber(speed / 3)} ${speedUnit}`,
    `${fmtNumber(speed * 100)} ${speedUnit}`,
  ];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);

  const namedError = distractors.includes(multiplied)
    ? ` The ${multiplied} option multiplies distance by time instead of dividing.`
    : '';
  return {
    stem: `${scenario} covers ${fmtNumber(distance)} ${distanceUnit} in ${fmtNumber(time)} ${timeUnit}. What is its average speed?`,
    correct,
    distractors,
    explanation: `Average speed $=\\dfrac{\\text{distance}}{\\text{time}}=\\dfrac{${fmtNumber(distance)}\\text{ ${distanceUnit}}}{${fmtNumber(time)}\\text{ ${timeUnit}}}=${fmtNumber(speed)}\\text{ ${speedUnit}}$.${namedError}`,
  };
}

export const physSpeed: QuestionGenerator<SpeedParams> = {
  id: 'phys-speed',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
