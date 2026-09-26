import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, toSubscript, uniqueDistractors } from './utils';

// Homologous series: series -> general formula, general formula -> series, a named
// member -> its series, and a named member -> its molecular formula. The series
// table is authored per topic; molecular formulas are CONSTRUCTED from the series'
// hydrogen rule (H = hFactor*n + hOffset), so butane is C4H10 because the table's
// alkane row says 2n+2, never by lookup of a hand-typed string that could drift.
//
// Series entries with hFactor = 0 (alcohols, carboxylic acids — whose formulas carry
// an O the CnHm pattern cannot express) still serve the recall modes but are never
// drawn for a molecular formula.
//
// Distractors are the named errors: the neighbouring series' general formula, the
// same carbon count with the wrong series' hydrogen rule (C3H6 for propane), and
// one carbon more or fewer.

const MODES = ['series-to-formula', 'formula-to-series', 'molecular-formula', 'member-to-series'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  series: z
    .array(
      z.object({
        /** Plural, lowercase: "alkanes". */
        id: z.string().min(3),
        /** General formula in chemistry house style (unicode subscripts): "CₙH₂ₙ₊₂". */
        general: z.string().min(3),
        /** Hydrogen count rule: H = hFactor*n + hOffset. 0 = not usable for molecular formulas. */
        hFactor: z.number().int().min(0).max(4),
        hOffset: z.number().int().min(-2).max(4),
        /** Named members by carbon count (may be empty). */
        names: z.array(z.object({ n: z.number().int().min(1).max(10), name: z.string().min(3) })),
      })
    )
    .min(2),
});
export type OrganicSeriesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface OrganicSeriesValues {
  mode: Mode;
  seriesId: string;
  general: string;
  /** Molecular/member modes: the drawn member (n = 0 where unused). */
  n: number;
  name: string;
  hFactor: number;
  hOffset: number;
  generalPool: string[];
  seriesPool: string[];
  formulaPool: string[];
}

/** `C3H8` in house style (unicode subscripts, no subscript 1 on C). */
export function molecularFormula(n: number, hFactor: number, hOffset: number): string {
  const h = hFactor * n + hOffset;
  return `C${n > 1 ? toSubscript(n) : ''}H${h > 1 ? toSubscript(h) : ''}`;
}

/** `CₙH₂ₙ₊₂` in house style, from a hydrogen rule (for distractor perturbations). */
function generalFromRule(hFactor: number, hOffset: number): string {
  const offset = hOffset > 0 ? `₊${toSubscript(hOffset)}` : hOffset < 0 ? `₋${toSubscript(-hOffset)}` : '';
  return `CₙH${toSubscript(hFactor)}ₙ${offset}`;
}

export function draw(params: OrganicSeriesParams, rng: Rng): OrganicSeriesValues {
  const modes = params.modes ?? [...MODES];
  const molecularSeries = params.series.filter((s) => s.hFactor >= 1 && s.names.length > 0);
  const namedSeries = params.series.filter((s) => s.names.length > 0);
  const feasible = modes.filter((mode) => {
    if (mode === 'molecular-formula') return molecularSeries.length > 0;
    if (mode === 'member-to-series') return namedSeries.length > 0;
    return params.series.length >= 2;
  });
  if (feasible.length === 0) {
    throw new Error('chem-organic-series: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  const generalPool = [...new Set(params.series.map((s) => s.general))];
  const seriesPool = [...new Set(params.series.map((s) => `the ${s.id}`))];
  const formulaPool: string[] = [];
  for (const s of molecularSeries) {
    for (const member of s.names) formulaPool.push(molecularFormula(member.n, s.hFactor, s.hOffset));
  }

  if (mode === 'molecular-formula' || mode === 'member-to-series') {
    const pool = mode === 'molecular-formula' ? molecularSeries : namedSeries;
    const series = pick(pool, rng);
    const member = pick(series.names, rng);
    return {
      mode,
      seriesId: series.id,
      general: series.general,
      n: member.n,
      name: member.name,
      hFactor: series.hFactor,
      hOffset: series.hOffset,
      generalPool,
      seriesPool,
      formulaPool,
    };
  }

  const series = pick(params.series, rng);
  return {
    mode,
    seriesId: series.id,
    general: series.general,
    n: 0,
    name: '',
    hFactor: series.hFactor,
    hOffset: series.hOffset,
    generalPool,
    seriesPool,
    formulaPool,
  };
}

export function build(values: OrganicSeriesValues, rng: Rng): GeneratorOutput {
  const { mode, seriesId, general, n, name, hFactor, hOffset, generalPool, seriesPool, formulaPool } = values;

  if (mode === 'series-to-formula') {
    const perturbations = [
      generalFromRule(hFactor, hOffset + 2),
      generalFromRule(hFactor, hOffset - 2),
      generalFromRule(Math.max(1, hFactor - 1), hOffset),
      generalFromRule(hFactor + 1, hOffset),
    ];
    return {
      stem: `What is the general formula of the ${seriesId}?`,
      correct: general,
      distractors: uniqueDistractors(general, generalPool, perturbations, rng),
      explanation: `The ${seriesId} have general formula ${general}. Each homologous series has its own hydrogen count rule, so the neighbouring formulas in the choices belong to other series.`,
    };
  }

  if (mode === 'formula-to-series') {
    const correct = `the ${seriesId}`;
    return {
      stem: `Which homologous series has the general formula ${general}?`,
      correct,
      distractors: uniqueDistractors(correct, seriesPool, ['the esters', 'the polymers', 'the halogenoalkanes'], rng),
      explanation: `${general} is the general formula of the ${seriesId}. Matching a general formula to its series is a pure recall task — learn the table one row at a time.`,
    };
  }

  if (mode === 'member-to-series') {
    const correct = `the ${seriesId}`;
    return {
      stem: `Which homologous series does ${name} belong to?`,
      correct,
      distractors: uniqueDistractors(correct, seriesPool, ['the esters', 'the polymers', 'the halogenoalkanes'], rng),
      explanation: `${name.charAt(0).toUpperCase() + name.slice(1)} is a member of the ${seriesId} — its name ending and its formula both follow that series' pattern.`,
    };
  }

  // molecular-formula
  const correct = molecularFormula(n, hFactor, hOffset);
  const candidates = [
    // The wrong series' hydrogen rule at the same carbon count.
    [n, hFactor, hOffset - 2],
    [n, hFactor, hOffset + 2],
    // One carbon more, one fewer.
    [n + 1, hFactor, hOffset],
    [Math.max(1, n - 1), hFactor, hOffset],
  ]
    .filter(([cn, hf, ho]) => hf * cn + ho >= 2)
    .map(([cn, hf, ho]) => molecularFormula(cn, hf, ho));
  return {
    stem: `What is the molecular formula of ${name}?`,
    correct,
    distractors: uniqueDistractors(correct, candidates, formulaPool, rng),
    explanation: `${name.charAt(0).toUpperCase() + name.slice(1)} has $${n}$ carbon atom${n === 1 ? '' : 's'}, and the ${seriesId} have general formula ${general}, so the hydrogen count is $${hFactor} \\times ${n} ${hOffset >= 0 ? '+' : '-'} ${Math.abs(hOffset)} = ${hFactor * n + hOffset}$: the formula is ${correct}.`,
  };
}

export const chemOrganicSeries: QuestionGenerator<OrganicSeriesParams> = {
  id: 'chem-organic-series',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
