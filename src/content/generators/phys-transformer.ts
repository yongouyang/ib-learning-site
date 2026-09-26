import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Transformers: Vs/Vp = Ns/Np. The secondary and primary voltage modes are
// CONSTRUCTED from exact divisions — a (turns pair, voltage) combination is drawn
// only when the unknown voltage is a whole number. The step-type mode is the
// qualitative companion: more secondary turns than primary means step-up.
//
// Distractors are the named errors: the turns ratio applied the wrong way up, the
// input quoted unchanged (the DC misunderstanding), and the doubled answer.

const MODES = ['secondary-voltage', 'primary-voltage', 'step-type'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** [primary turns, secondary turns] pairs. */
  turnPairs: z
    .array(z.tuple([z.number().int().min(10).max(5000), z.number().int().min(10).max(5000)]))
    .min(2),
  /** Voltages in V. */
  voltages: z.array(z.number().int().min(2).max(500)).min(1),
});
export type TransformerParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface TransformerValues {
  mode: Mode;
  np: number;
  ns: number;
  /** The given voltage (Vp in secondary mode, Vs in primary mode). */
  given: number;
  /** The asked-for voltage. */
  answer: number;
}

export function draw(params: TransformerParams, rng: Rng): TransformerValues {
  const modes = params.modes ?? [...MODES];

  const secondaryCases: [number, number, number][] = [];
  const primaryCases: [number, number, number][] = [];
  for (const [np, ns] of params.turnPairs) {
    for (const v of params.voltages) {
      if ((v * ns) % np === 0) secondaryCases.push([np, ns, v]);
      if ((v * np) % ns === 0) primaryCases.push([np, ns, v]);
    }
  }
  const typePairs = params.turnPairs.filter(([np, ns]) => np !== ns);

  const feasible = modes.filter((mode) => {
    if (mode === 'secondary-voltage') return secondaryCases.length > 0;
    if (mode === 'primary-voltage') return primaryCases.length > 0;
    return typePairs.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('phys-transformer: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'secondary-voltage') {
    const [np, ns, vp] = pick(secondaryCases, rng);
    return { mode, np, ns, given: vp, answer: (vp * ns) / np };
  }
  if (mode === 'primary-voltage') {
    const [np, ns, vs] = pick(primaryCases, rng);
    return { mode, np, ns, given: vs, answer: (vs * np) / ns };
  }
  const [np, ns] = pick(typePairs, rng);
  return { mode, np, ns, given: 0, answer: 0 };
}

export function build(values: TransformerValues, rng: Rng): GeneratorOutput {
  const { mode, np, ns, given, answer } = values;

  if (mode === 'secondary-voltage') {
    const correct = `$${answer}$ V`;
    const wrongWay = cleanNumbers([(given * np) / ns]);
    const distractors = uniqueNumericDistractors(answer, [...wrongWay, given, answer * 2], rng).map(
      (v) => `$${fmtNumber(v)}$ V`
    ) as [string, string, string];
    const wrongWayNote =
      wrongWay.length > 0 ? ` The turns ratio applied the wrong way up gives $${fmtNumber(wrongWay[0])}$ V.` : '';
    return {
      stem: `A transformer has $${np}$ turns on its primary coil and $${ns}$ turns on its secondary coil. The input voltage across the primary is $${given}$ V. What is the output voltage across the secondary?`,
      correct,
      distractors,
      explanation: `$\\dfrac{V_s}{V_p} = \\dfrac{N_s}{N_p}$, so $V_s = ${given} \\times \\dfrac{${ns}}{${np}} = ${answer}$ V — ${
        ns > np ? 'more secondary turns must step the voltage up' : 'fewer secondary turns must step the voltage down'
      }.${wrongWayNote}`,
    };
  }

  if (mode === 'primary-voltage') {
    const correct = `$${answer}$ V`;
    const distractors = uniqueNumericDistractors(
      answer,
      cleanNumbers([(given * ns) / np, given, answer * 2, answer / 2]),
      rng
    ).map((v) => `$${fmtNumber(v)}$ V`) as [string, string, string];
    return {
      stem: `A transformer has $${np}$ turns on its primary coil and $${ns}$ turns on its secondary coil. The output voltage is $${given}$ V. What input voltage is needed?`,
      correct,
      distractors,
      explanation: `$\\dfrac{V_p}{V_s} = \\dfrac{N_p}{N_s}$, so $V_p = ${given} \\times \\dfrac{${np}}{${ns}} = ${answer}$ V. Multiplying by the ratio the wrong way up gives the output scaled the wrong direction.`,
    };
  }

  const up = ns > np;
  const correct = up
    ? 'A step-up transformer — the output voltage is higher than the input'
    : 'A step-down transformer — the output voltage is lower than the input';
  const candidates = [
    up
      ? 'A step-down transformer — the output voltage is lower than the input'
      : 'A step-up transformer — the output voltage is higher than the input',
    up
      ? 'A step-down transformer — the output voltage is higher than the input'
      : 'A step-up transformer — the output voltage is lower than the input',
  ];
  return {
    stem: `A transformer has $${np}$ turns on its primary coil and $${ns}$ turns on its secondary coil. What kind of transformer is it, and what happens to the voltage?`,
    correct,
    distractors: uniqueDistractors(
      correct,
      candidates,
      ['An isolating transformer — the voltage is unchanged', 'A step-up transformer — the current is unchanged'],
      rng
    ),
    explanation: `The secondary has $${ns}$ turns against $${np}$ on the primary — ${up ? 'more' : 'fewer'} turns means the voltage is stepped ${up ? 'up' : 'down'}, in the ratio $\\dfrac{N_s}{N_p} = \\dfrac{${ns}}{${np}}$.`,
  };
}

export const physTransformer: QuestionGenerator<TransformerParams> = {
  id: 'phys-transformer',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
