import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, shuffle, uniqueDistractors } from './utils';

// Chemical tests for ions: given the ion and the test, recall the observation; or
// given the test and the observation, name the ion. Pure table-driven recall — the
// params table is the topic's test results, one row per (ion, procedure,
// observation), and the distractors are the other rows' answers. Both directions
// matter: "what do you see" and "which ion is this" are the two ways exams ask it.
//
// The table rows should keep ions DISTINCT (an observation-to-ion question reads
// ambiguously otherwise); the procedure text disambiguates shared observations (a
// white precipitate means chloride with silver nitrate but sulfate with barium
// chloride).

const MODES = ['test-to-observation', 'observation-to-ion'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** One row per test: ion name, the procedure (lowercase, no trailing period), the observation (lowercase fragment). */
  tests: z
    .array(
      z.object({
        ion: z.string().min(1),
        procedure: z.string().min(5),
        observation: z.string().min(5),
      })
    )
    .min(4),
});
export type IonTestsParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface IonTestsValues {
  mode: Mode;
  ion: string;
  procedure: string;
  observation: string;
  /** Every observation in the table, capitalised (distractor pool). */
  observationPool: string[];
  /** Every ion in the table (distractor pool). */
  ionPool: string[];
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function draw(params: IonTestsParams, rng: Rng): IonTestsValues {
  const modes = params.modes ?? [...MODES];
  const mode = pick(modes, rng);
  const row = pick(params.tests, rng);
  return {
    mode,
    ion: row.ion,
    procedure: row.procedure,
    observation: row.observation,
    observationPool: shuffle([...new Set(params.tests.map((t) => cap(t.observation)))], rng),
    ionPool: shuffle([...new Set(params.tests.map((t) => t.ion))], rng),
  };
}

export function build(values: IonTestsValues, rng: Rng): GeneratorOutput {
  const { mode, ion, procedure, observation, observationPool, ionPool } = values;

  if (mode === 'test-to-observation') {
    const correct = cap(observation);
    return {
      stem: `A compound contains ${ion} ions. ${cap(procedure)}. What is observed?`,
      correct,
      distractors: uniqueDistractors(
        correct,
        observationPool,
        ['No visible change occurs', 'The solution turns colourless', 'A colourless gas is evolved'],
        rng
      ),
      explanation: `${correct} — that is the characteristic result for ${ion} ions with this test. The other observations belong to different ions in the table.`,
    };
  }

  const correct = ion;
  return {
    stem: `An unknown compound is tested: ${procedure}. ${cap(observation)}. Which ion is present?`,
    correct,
    distractors: uniqueDistractors(correct, ionPool, ['sodium', 'sulfate', 'copper(II)'], rng),
    explanation: `${cap(observation)} when ${procedure}: that is the characteristic result for ${correct} ions. Each ion test pairs one procedure with one observation.`,
  };
}

export const chemIonTests: QuestionGenerator<IonTestsParams> = {
  id: 'chem-ion-tests',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
