import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueNumericDistractors } from './utils';

// Wave speed v = f x lambda, asked for the speed or the wavelength, plus the
// frequency/period pair f = 1/T. Every value is constructed from a whole-number
// frequency and wavelength, so no answer depends on a rounding convention the
// question never states.
//
// Distractors are the named errors: dividing where the formula multiplies (and
// vice versa), adding the two given values, and the classic period slip
// (T = f instead of T = 1/f, or a factor of ten out).

const MODES = ['speed', 'wavelength', 'frequency', 'period'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Frequencies in Hz. */
  frequencies: z.array(z.number().positive()).min(1),
  /** Wavelengths in m. */
  wavelengths: z.array(z.number().positive()).min(1),
  /** Periods in s, for the f = 1/T direction. */
  periods: z.array(z.number().positive()).min(1),
});
export type WaveSpeedParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface WaveSpeedValues {
  mode: Mode;
  frequency: number;
  wavelength: number;
  period: number;
  answer: number;
  /** Answer unit: m/s, m, Hz or s. */
  unit: string;
}

const clean = (n: number, dp = 3) => Number.isFinite(n) && Math.abs(n * 10 ** dp - Math.round(n * 10 ** dp)) < 1e-9;

export function draw(params: WaveSpeedParams, rng: Rng): WaveSpeedValues {
  const modes = params.modes ?? [...MODES];
  const feasible = modes.filter((m) => {
    if (m === 'speed') return params.frequencies.length > 0 && params.wavelengths.length > 0;
    if (m === 'wavelength') return params.frequencies.some((f) => params.wavelengths.some((l) => clean(f * l))) && params.wavelengths.length > 0;
    if (m === 'frequency') return params.periods.some((T) => clean(1 / T));
    return params.frequencies.some((f) => clean(1 / f));
  });
  if (feasible.length === 0) {
    throw new Error('phys-wave-speed: no mode is feasible for this param table — add frequencies, wavelengths and periods');
  }
  const mode = pick(feasible, rng);

  if (mode === 'speed') {
    const frequency = pick(params.frequencies, rng);
    const wavelength = pick(params.wavelengths, rng);
    return { mode, frequency, wavelength, period: 0, answer: frequency * wavelength, unit: 'm/s' };
  }
  if (mode === 'wavelength') {
    const frequency = pick(params.frequencies, rng);
    const wavelength = pick(params.wavelengths, rng);
    return { mode, frequency, wavelength, period: 0, answer: wavelength, unit: 'm' };
  }
  if (mode === 'frequency') {
    const period = pick(
      params.periods.filter((T) => clean(1 / T)),
      rng
    );
    return { mode, frequency: 1 / period, wavelength: 0, period, answer: 1 / period, unit: 'Hz' };
  }
  const frequency = pick(
    params.frequencies.filter((f) => clean(1 / f)),
    rng
  );
  return { mode, frequency, wavelength: 0, period: 1 / frequency, answer: 1 / frequency, unit: 's' };
}

const withUnit = (v: number, unit: string) => `${fmtNumber(v)} ${unit}`;

export function build(values: WaveSpeedValues, rng: Rng): GeneratorOutput {
  const { mode, frequency, wavelength, period, answer } = values;

  if (mode === 'speed') {
    const stem = `A wave has a frequency of ${withUnit(frequency, 'Hz')} and a wavelength of ${withUnit(wavelength, 'm')}. What is its speed?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([wavelength / frequency, frequency + wavelength, answer * 10, answer / 10]), rng).map(
      (v) => withUnit(v, 'm/s')
    ) as [string, string, string];
    const note = distractors.includes(withUnit(frequency + wavelength, 'm/s'))
      ? ` The ${withUnit(frequency + wavelength, 'm/s')} option adds instead of multiplying.`
      : '';
    return {
      stem,
      correct: withUnit(answer, 'm/s'),
      distractors,
      explanation: `Wave speed $= \\text{frequency} \\times \\text{wavelength} = ${fmtNumber(frequency)} \\times ${fmtNumber(wavelength)} = ${fmtNumber(answer)}\\text{ m/s}$.${note}`,
    };
  }

  if (mode === 'wavelength') {
    const speed = frequency * wavelength;
    const stem = `A wave travels at ${withUnit(speed, 'm/s')} with a frequency of ${withUnit(frequency, 'Hz')}. What is its wavelength?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([speed * frequency, frequency / speed, answer * 10, answer / 10]), rng).map(
      (v) => withUnit(v, 'm')
    ) as [string, string, string];
    const note = distractors.includes(withUnit(speed * frequency, 'm')) ? ` The ${withUnit(speed * frequency, 'm')} option multiplies instead of dividing.` : '';
    return {
      stem,
      correct: withUnit(answer, 'm'),
      distractors,
      explanation: `Rearranged, wavelength $= \\dfrac{\\text{speed}}{\\text{frequency}} = \\dfrac{${fmtNumber(speed)}}{${fmtNumber(frequency)}} = ${fmtNumber(answer)}\\text{ m}$.${note}`,
    };
  }

  if (mode === 'frequency') {
    const stem = `A wave has a time period of ${withUnit(period, 's')}. What is its frequency?`;
    const distractors = uniqueNumericDistractors(answer, cleanNumbers([period, 1 / (2 * period), answer * 10, answer / 10]), rng).map(
      (v) => withUnit(v, 'Hz')
    ) as [string, string, string];
    const note = distractors.includes(withUnit(period, 'Hz')) ? ` The ${withUnit(period, 'Hz')} option gives the period, not the frequency.` : '';
    return {
      stem,
      correct: withUnit(answer, 'Hz'),
      distractors,
      explanation: `Frequency $= \\dfrac{1}{\\text{period}} = \\dfrac{1}{${fmtNumber(period)}} = ${fmtNumber(answer)}\\text{ Hz}$.${note}`,
    };
  }

  const stem = `A wave has a frequency of ${withUnit(frequency, 'Hz')}. What is its time period?`;
  const distractors = uniqueNumericDistractors(answer, cleanNumbers([frequency, 1 / (2 * frequency), answer * 10, answer / 10]), rng).map(
    (v) => withUnit(v, 's')
  ) as [string, string, string];
  const note = distractors.includes(withUnit(frequency, 's')) ? ` The ${withUnit(frequency, 's')} option gives the frequency, not the period.` : '';
  return {
    stem,
    correct: withUnit(answer, 's'),
    distractors,
    explanation: `Time period $= \\dfrac{1}{\\text{frequency}} = \\dfrac{1}{${fmtNumber(frequency)}} = ${fmtNumber(answer)}\\text{ s}$.${note}`,
  };
}

export const physWaveSpeed: QuestionGenerator<WaveSpeedParams> = {
  id: 'phys-wave-speed',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
