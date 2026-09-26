import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { cleanNumbers, fmtNumber, pick, shuffle, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Separating mixtures: given a mixture, name the technique; given a technique,
// pick the mixture it separates; and compute an Rf value from a chromatogram. The
// mixture/method table is authored per topic; the Rf mode CONSTRUCTS its numbers —
// the spot and solvent-front distances are drawn only when the quotient spot/front
// prints cleanly (0.25, 0.4, ...), never as a repeating decimal.
//
// Distractors are the named errors: the neighbouring techniques in the table, and
// for Rf the inverted quotient (front/spot), the difference measured from the
// solvent front, and the raw distances without dividing.

const MODES = ['mixture-to-method', 'method-to-mixture', 'rf'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** One row per separation: the mixture description and the technique that separates it. */
  cases: z
    .array(
      z.object({
        mixture: z.string().min(5),
        method: z.string().min(3),
      })
    )
    .min(4),
  /** Solvent-front distances in cm for the Rf mode. */
  fronts: z.array(z.number().int().min(6).max(20)).min(1),
  /** Spot distances in cm for the Rf mode. */
  spots: z.array(z.number().int().min(1).max(15)).min(1),
});
export type SeparationParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface SeparationValues {
  mode: Mode;
  mixture: string;
  method: string;
  /** Rf mode: distances travelled, in cm. */
  spot: number;
  front: number;
  methodPool: string[];
  mixturePool: string[];
}

export function draw(params: SeparationParams, rng: Rng): SeparationValues {
  const modes = params.modes ?? [...MODES];
  // Rf pairs: spot < front and the quotient prints cleanly.
  const rfPairs: [number, number][] = [];
  for (const front of params.fronts) {
    for (const spot of params.spots) {
      if (spot < front && cleanNumbers([spot / front]).length === 1) rfPairs.push([spot, front]);
    }
  }
  const feasible = modes.filter((mode) => {
    if (mode === 'rf') return rfPairs.length > 0;
    return params.cases.length >= 4;
  });
  if (feasible.length === 0) {
    throw new Error('chem-separation: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  const pools = {
    methodPool: shuffle([...new Set(params.cases.map((c) => c.method))], rng),
    mixturePool: shuffle([...new Set(params.cases.map((c) => c.mixture))], rng),
  };

  if (mode === 'rf') {
    const [spot, front] = pick(rfPairs, rng);
    return { mode, mixture: '', method: '', spot, front, ...pools };
  }

  const row = pick(params.cases, rng);
  return { mode, mixture: row.mixture, method: row.method, spot: 0, front: 0, ...pools };
}

export function build(values: SeparationValues, rng: Rng): GeneratorOutput {
  const { mode, mixture, method, spot, front, methodPool, mixturePool } = values;

  if (mode === 'mixture-to-method') {
    return {
      stem: `Which technique is best for separating ${mixture}?`,
      correct: method,
      distractors: uniqueDistractors(
        method,
        methodPool,
        ['evaporation to dryness', 'decanting', 'sieving', 'using a condenser on its own'],
        rng
      ),
      explanation: `${method.charAt(0).toUpperCase() + method.slice(1)} is the technique that exploits this mixture's properties. The other options suit different mixtures — match the technique to what the mixture actually contains.`,
    };
  }

  if (mode === 'method-to-mixture') {
    return {
      stem: `Which of these mixtures is best separated using ${method}?`,
      correct: mixture,
      distractors: uniqueDistractors(mixture, mixturePool, ['sand mixed into water', 'the dyes in a food colouring'], rng),
      explanation: `${method.charAt(0).toUpperCase() + method.slice(1)} works for ${mixture}, because that mixture has the property this technique exploits. The other mixtures need a different technique.`,
    };
  }

  const rf = spot / front;
  const correct = fmtNumber(rf);
  const candidates = cleanNumbers([front / spot, (front - spot) / front, front - spot, spot]);
  return {
    stem: `In a chromatography experiment, a spot travels $${spot}$ cm from the baseline and the solvent front travels $${front}$ cm. What is the $R_f$ value of the spot?`,
    correct,
    distractors: uniqueNumericDistractors(rf, candidates, rng).map(fmtNumber) as [string, string, string],
    explanation: `$R_f = \\dfrac{\\text{distance moved by the spot}}{\\text{distance moved by the solvent front}} = \\dfrac{${spot}}{${front}} = ${correct}$. Dividing the wrong way up gives a value above $1$, which no $R_f$ value can be.`,
  };
}

export const chemSeparation: QuestionGenerator<SeparationParams> = {
  id: 'chem-separation',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
