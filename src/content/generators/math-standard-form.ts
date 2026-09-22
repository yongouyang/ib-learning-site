import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, uniqueDistractors } from './utils';

// Standard form (scientific notation): write an ordinary number in standard form,
// write a standard-form number as an ordinary number, and multiply/divide two
// standard-form numbers keeping the answer in standard form.
//
// The ordinary number is SHIFTED FROM THE MANTISSA'S OWN DIGITS rather than
// computed as `m * 10 ** p`: 7.8e-5 through floating point is 0.00007800000000000001,
// and a question whose stem shows that is worse than no question. Every exponent
// produced by a multiplication or division is normalised back into 1 <= m < 10, so
// the answer is always in standard form even when the raw mantissa is not.
//
// Distractors are the named errors: a power off by one, an un-normalised mantissa
// (`56 x 10^3`), multiplying the powers instead of adding them, shifting the
// decimal point the wrong way, and inverting the division.
//
// Only modes the param table can actually answer are drawn (a quotient such as
// 5.6 / 1.5 does not terminate), and the mantissa is kept to 3 d.p. rather than 2:
// normalising 13.95 shows as 1.395, and rounding that to 1.4 made the printed
// answer wrong in its last digit — the sweep in tests/unit/generators.test.ts
// caught it.

const MODES = ['to-standard', 'to-ordinary', 'multiply', 'divide'] as const;

export const paramsSchema = z
  .object({
    modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
    /** Mantissas, 1 <= m < 10, at most 1 d.p. so the ordinary number stays exact. */
    mantissas: z.array(z.number().min(1).max(9.9)).min(1),
    /** Powers of 10 to use. */
    powers: z.array(z.number().int().min(-12).max(20)).min(1),
    /** Second factor / divisor mantissas for the multiply and divide modes. */
    partners: z.array(z.number().min(1).max(9.9)).min(1),
  })
  .refine((p) => p.powers.some((v) => v >= 2), {
    message: 'math-standard-form: needs a power >= 2, or the ordinary number is not a whole number',
  })
  .refine((p) => p.powers.some((v) => v !== 0), {
    message: 'math-standard-form: needs a non-zero power, or the "ordinary number" answer is already in standard form',
  })
  .refine((p) => p.mantissas.every((m) => Number.isInteger(Math.round(m * 10))), {
    message: 'math-standard-form: mantissas must have at most 1 decimal place',
  });
export type StandardFormParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface StandardFormValues {
  mode: Mode;
  /** First mantissa. */
  m1: number;
  /** Second mantissa (multiply/divide only). */
  m2?: number;
  p1: number;
  p2?: number;
}

/** True when `n` is exact to at most 3 decimal places (so a mantissa can show it). */
function terminates(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-9;
}

export function draw(params: StandardFormParams, rng: Rng): StandardFormValues {
  // Normalise the schema defaults here too — draw() is called with a plain object
  // by unit tests and future callers.
  const modes = params.modes ?? [...MODES];
  const m1 = pick(params.mantissas, rng);

  // Only FEASIBLE modes are drawn, so no seed can produce an unanswerable quotient:
  // 5.6 / 1.5 does not terminate, and rounding it would make the printed answer
  // wrong in its last digit (which is exactly how the 9.3 x 1.5 = 13.95 -> "1.4"
  // defect was found by the sweep).
  const feasible = modes.filter((m) => {
    if (m === 'divide') return params.partners.some((p) => terminates(m1 / p));
    if (m === 'multiply') return params.partners.length > 0;
    if (m === 'to-standard') return params.powers.some((v) => v >= 2);
    if (m === 'to-ordinary') return params.powers.some((v) => v !== 0);
    return true;
  });
  if (feasible.length === 0) {
    throw new Error('math-standard-form: no mode is feasible for this param table — check mantissas, partners and powers');
  }
  const mode = pick(feasible, rng);

  if (mode === 'multiply' || mode === 'divide') {
    const partners = mode === 'divide' ? params.partners.filter((p) => terminates(m1 / p)) : params.partners;
    return { mode, m1, m2: pick(partners, rng), p1: pick(params.powers, rng), p2: pick(params.powers, rng) };
  }
  if (mode === 'to-standard') {
    return { mode, m1, p1: pick(params.powers.filter((v) => v >= 2), rng) };
  }
  return { mode, m1, p1: pick(params.powers.filter((v) => v !== 0), rng) };
}

/** The mantissa's digits with the point moved `places` to the right (negative = left). */
function shift(mantissa: number, places: number): string {
  const [whole, fraction = ''] = String(mantissa).split('.');
  const digits = `${whole}${fraction}`;
  const point = whole.length + places; // position of the decimal point inside `digits`
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${digits}${'0'.repeat(point - digits.length)}`;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** `370000` -> `370\,000`; `0.000078` -> `0.000\,078` (house style). */
function spaced(plain: string): string {
  const [whole, fraction] = plain.split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
  if (fraction === undefined) return groupedWhole;
  return `${groupedWhole}.${fraction.replace(/(\d{3})(?=\d)/g, '$1\\,')}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const powerOfTen = (p: number) => `10^{${p}}`;

/** `5.6 x 10^4` (braces always — KaTeX accepts them for positive powers too). */
function standardForm(mantissa: number, exponent: number): string {
  return `$${round3(mantissa)} \\times ${powerOfTen(exponent)}$`;
}

export function build(values: StandardFormValues, rng: Rng): GeneratorOutput {
  const { mode, m1, p1 } = values;

  if (mode === 'to-standard') {
    const ordinary = spaced(shift(m1, p1));
    const stem = `Write $${ordinary}$ in standard form.`;
    const correct = standardForm(m1, p1);
    const candidates = [
      standardForm(m1, p1 + 1),
      standardForm(m1, p1 - 1),
      `$${spaced(shift(m1, 1))} \\times ${powerOfTen(p1 - 1)}$`,
      standardForm(m1 / 10, p1 + 1),
    ];
    const fallback = [standardForm(m1 * 2, p1), standardForm(m1, p1 + 2), standardForm(m1 + 1, p1), standardForm(1, p1)];
    const distractors = uniqueDistractors(correct, candidates, fallback, rng);
    const explanation = `Move the decimal point until exactly one non-zero digit stands in front of it: $${ordinary}$. In standard form that is ${correct}.`;
    return { stem, correct, distractors, explanation };
  }

  if (mode === 'to-ordinary') {
    const ordinary = spaced(shift(m1, p1));
    const stem = `Write ${standardForm(m1, p1)} as an ordinary number.`;
    const correct = `$${ordinary}$`;
    const candidates = [
      `$${spaced(shift(m1, p1 + 1))}$`,
      `$${spaced(shift(m1, p1 - 1))}$`,
      `$${spaced(String(round2(m1)))}$`,
      `$${spaced(shift(m1, p1 + 2))}$`,
    ];
    const fallback = [`$${spaced(shift(m1, p1 - 2))}$`, `$${spaced(shift(m1 * 2, p1))}$`];
    const distractors = uniqueDistractors(correct, candidates, fallback, rng);
    const direction = p1 > 0 ? 'right' : 'left';
    const explanation = `$${powerOfTen(p1)}$ moves the decimal point $${Math.abs(p1)}$ place${Math.abs(p1) === 1 ? '' : 's'} ${direction}: ${standardForm(m1, p1)} = $${ordinary}$.`;
    return { stem, correct, distractors, explanation };
  }

  const m2 = values.m2 ?? 1;
  const p2 = values.p2 ?? 0;
  const raw = mode === 'multiply' ? m1 * m2 : m1 / m2;
  const rawPower = mode === 'multiply' ? p1 + p2 : p1 - p2;
  let exponent = rawPower;
  let mantissa = raw;
  while (mantissa >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  while (mantissa < 1) {
    mantissa *= 10;
    exponent -= 1;
  }
  // 3 d.p., not 2: dividing a 2 d.p. product by 10 (13.95 -> 1.395) is lossless at
  // 3 d.p. and LOSSY at 2, which is how a wrong answer shipped for one commit.
  mantissa = Math.round(mantissa * 1000) / 1000;

  const operator = mode === 'multiply' ? '\\times' : '\\div';
  const stem = `Simplify $(${standardForm(m1, p1).slice(1, -1)}) ${operator} (${standardForm(m2, p2).slice(1, -1)})$, giving your answer in standard form.`;
  const correct = standardForm(mantissa, exponent);
  const combined = mode === 'multiply' ? p1 + p2 : p1 - p2;
  const candidates = [
    standardForm(mantissa, mode === 'multiply' ? p1 * p2 : p2 - p1),
    standardForm(mode === 'multiply' ? m1 + m2 : m2 / m1, combined),
    standardForm(mantissa * 10, exponent),
    standardForm(mantissa, exponent + 1),
    standardForm(mantissa, exponent - 1),
  ];
  const fallback = [standardForm(mantissa * 2, exponent), standardForm(mantissa + 1, exponent)];
  const distractors = uniqueDistractors(correct, candidates, fallback, rng);
  const mantissaStep = `${mode === 'multiply' ? 'multiply' : 'divide'} the mantissas: $${m1} ${operator} ${m2} = ${round3(raw)}$`;
  const powerStep = `${mode === 'multiply' ? 'add' : 'subtract'} the powers: $${powerOfTen(p1)} ${operator} ${powerOfTen(p2)} = ${powerOfTen(rawPower)}$`;
  const normalise =
    mantissa === raw
      ? ''
      : ` The mantissa must be at least 1 and below 10, so $${round3(raw)} \\times ${powerOfTen(rawPower)}$ converts to ${correct}.`;
  const explanation = `First ${mantissaStep}, then ${powerStep}.${normalise} The answer is ${correct}.`;
  return { stem, correct, distractors, explanation };
}

export const mathStandardForm: QuestionGenerator<StandardFormParams> = {
  id: 'math-standard-form',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
