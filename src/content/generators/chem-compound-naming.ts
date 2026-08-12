import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { chargeSuperscript, gcd, pick, pickDistinct, toSubscript, uniqueDistractors } from './utils';

// Compound naming in both families:
//  - ionic: derive the formula from the two ions' charges (swap-and-drop);
//  - covalent: prefix naming in both directions (N2O4 <-> dinitrogen tetroxide).
// Formulas use unicode subscripts (house style: Al2O3 written with real
// subscript characters).

const ionicSchema = z.object({
  cationSymbol: z.string().min(1),
  cationName: z.string().min(1),
  /** Positive charge magnitude (1..3). */
  cationCharge: z.number().int().min(1).max(3),
  anionSymbol: z.string().min(1),
  anionName: z.string().min(1),
  /** Negative charge magnitude (1..3). */
  anionCharge: z.number().int().min(1).max(3),
  formula: z.string().min(1),
  name: z.string().min(1),
});

const covalentSchema = z.object({
  formula: z.string().min(1),
  name: z.string().min(1),
});

export const paramsSchema = z.object({
  ionic: z.array(ionicSchema).min(1),
  covalent: z.array(covalentSchema).default([]),
  modes: z.array(z.enum(['ionic-formula', 'covalent-name', 'covalent-formula'])).optional(),
});
export type IonicEntry = z.infer<typeof ionicSchema>;
export type CovalentEntry = z.infer<typeof covalentSchema>;
export type CompoundNamingParams = z.infer<typeof paramsSchema>;

type Mode = 'ionic-formula' | 'covalent-name' | 'covalent-formula';

export interface CompoundNamingValues {
  mode: Mode;
  ionic: IonicEntry | null;
  covalent: CovalentEntry | null;
  /** Fallback pools resolved from the params tables (siblings). */
  ionicFormulaPool: string[];
  covalentNamePool: string[];
  covalentFormulaPool: string[];
}

export function draw(params: CompoundNamingParams, rng: Rng): CompoundNamingValues {
  const requested: Mode[] = params.modes ?? ['ionic-formula', 'covalent-name', 'covalent-formula'];
  const available = requested.filter((m) =>
    m === 'ionic-formula' ? params.ionic.length > 0 : params.covalent.length > 0
  );
  if (available.length === 0) {
    throw new Error('chem-compound-naming: no mode available for the given params tables');
  }
  const mode = pick(available, rng);
  return {
    mode,
    ionic: mode === 'ionic-formula' ? pick(params.ionic, rng) : null,
    covalent: mode === 'ionic-formula' ? null : pick(params.covalent, rng),
    ionicFormulaPool: params.ionic.map((e) => e.formula),
    covalentNamePool: params.covalent.map((e) => e.name),
    covalentFormulaPool: params.covalent.map((e) => e.formula),
  };
}

function sub(n: number): string {
  return n > 1 ? toSubscript(n) : '';
}

/**
 * Swap-and-drop: cross the charge magnitudes over as subscripts, then reduce
 * the ratio (Mg2+ / O2- -> Mg2O2 -> MgO). Monatomic ions only — polyatomic
 * ions would need brackets. The params entry's `formula`/`name` are used for
 * display and fallback pools; the correct answer is always derived here from
 * the charges, so an inconsistent table entry shows up as formula !== derived
 * (the unit tests assert entry.formula === crissCross(...) for every entry).
 */
export function crissCross(
  cationSymbol: string,
  cationCharge: number,
  anionSymbol: string,
  anionCharge: number
): string {
  const g = gcd(cationCharge, anionCharge);
  const cationCount = anionCharge / g;
  const anionCount = cationCharge / g;
  return `${cationSymbol}${sub(cationCount)}${anionSymbol}${sub(anionCount)}`;
}

const PREFIXES = ['mono', 'di', 'tri', 'tetra', 'penta', 'hexa'];

/** Prefix-slip variants of a covalent name ("dinitrogen tetroxide" -> "dinitrogen trioxide", "nitrogen tetroxide", ...). */
function nameMutations(name: string): string[] {
  const words = name.split(' ');
  const out: string[] = [];
  words.forEach((word, wi) => {
    const prefix = PREFIXES.find((p) => word.startsWith(p));
    if (!prefix) return;
    const rest = word.slice(prefix.length);
    for (const other of PREFIXES) {
      if (other !== prefix) {
        out.push([...words.slice(0, wi), other + rest, ...words.slice(wi + 1)].join(' '));
      }
    }
    // Missing/wrong mono- slip: drop the prefix entirely.
    out.push([...words.slice(0, wi), rest, ...words.slice(wi + 1)].join(' '));
  });
  return out;
}

const SUBSCRIPT_CHARS = '₀₁₂₃₄₅₆₇₈₉';

/** Parse a binary covalent formula with unicode subscripts (N2O4 -> {N, 2, O, 4}). */
function parseBinaryFormula(
  formula: string
): { el1: string; n1: number; el2: string; n2: number } | null {
  const plain = formula.replace(/[₀-₉]/g, (c) => String(SUBSCRIPT_CHARS.indexOf(c)));
  const m = plain.match(/^([A-Z][a-z]?)(\d*)([A-Z][a-z]?)(\d*)$/);
  if (!m) return null;
  return {
    el1: m[1],
    n1: m[2] ? parseInt(m[2], 10) : 1,
    el2: m[3],
    n2: m[4] ? parseInt(m[4], 10) : 1,
  };
}

function renderFormula(el1: string, n1: number, el2: string, n2: number): string {
  return `${el1}${sub(n1)}${el2}${sub(n2)}`;
}

/** Subscript-slip variants of a binary formula (N2O4 -> N2O3, NO4, N4O2, ...). */
function formulaMutations(formula: string): string[] {
  const parsed = parseBinaryFormula(formula);
  if (!parsed) return [];
  const { el1, n1, el2, n2 } = parsed;
  const out: string[] = [];
  if (n2 > 1) out.push(renderFormula(el1, n1, el2, n2 - 1));
  out.push(renderFormula(el1, n1, el2, n2 + 1));
  if (n1 > 1) out.push(renderFormula(el1, n1 - 1, el2, n2));
  out.push(renderFormula(el1, n1 + 1, el2, n2));
  out.push(renderFormula(el1, n2, el2, n1)); // swapped subscripts
  return out;
}

export function build(values: CompoundNamingValues, rng: Rng): GeneratorOutput {
  if (values.mode === 'ionic-formula') {
    const entry = values.ionic as IonicEntry;
    const { cationSymbol, cationCharge, anionSymbol, anionCharge, name } = entry;
    const correct = crissCross(cationSymbol, cationCharge, anionSymbol, anionCharge);
    const cation = `${cationSymbol}${chargeSuperscript(cationCharge, '+')}`;
    const anion = `${anionSymbol}${chargeSuperscript(anionCharge, '-')}`;
    const candidates = [
      // Charges not crossed: 1:1 (AlO).
      `${cationSymbol}${anionSymbol}`,
      // Ratio not reduced (Mg2O2 style).
      `${cationSymbol}${sub(anionCharge)}${anionSymbol}${sub(cationCharge)}`,
      // Subscripts swapped (Al3O2).
      `${cationSymbol}${sub(cationCharge)}${anionSymbol}${sub(anionCharge)}`,
    ];
    const distractors = uniqueDistractors(correct, candidates, values.ionicFormulaPool, rng);
    const g = gcd(cationCharge, anionCharge);
    const cationCount = anionCharge / g;
    const anionCount = cationCharge / g;
    return {
      stem: `What is the formula of ${name}? (${cation} and ${anion})`,
      correct,
      distractors,
      explanation: String.raw`Swap and drop the charges: ${cation} and ${anion} give ${correct}. Charge check: $${cationCount}\times(+${cationCharge})+${anionCount}\times(-${anionCharge})=0$ — the charges balance.`,
    };
  }

  const entry = values.covalent as CovalentEntry;
  if (values.mode === 'covalent-name') {
    // Formula -> name ("Name the compound N2O4").
    const mutations = pickDistinct(nameMutations(entry.name), 3, rng);
    const distractors = uniqueDistractors(entry.name, mutations, values.covalentNamePool, rng);
    return {
      stem: `Name the compound ${entry.formula}.`,
      correct: entry.name,
      distractors,
      explanation: `Use prefixes: di- = 2, tri- = 3, tetra- = 4, and drop mono- on the first element. Count the atoms in ${entry.formula} and the name is ${entry.name}.`,
    };
  }
  // Name -> formula ("What is the formula of sulfur trioxide?").
  const mutations = pickDistinct(formulaMutations(entry.formula), 3, rng);
  const distractors = uniqueDistractors(
    entry.formula,
    mutations,
    values.covalentFormulaPool,
    rng
  );
  return {
    stem: `What is the formula of ${entry.name}?`,
    correct: entry.formula,
    distractors,
    explanation: `Read the prefixes: di- = 2, tri- = 3, tetra- = 4 (no prefix on the first element means 1). So ${entry.name} is ${entry.formula}.`,
  };
}

export const chemCompoundNaming: QuestionGenerator<CompoundNamingParams> = {
  id: 'chem-compound-naming',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
