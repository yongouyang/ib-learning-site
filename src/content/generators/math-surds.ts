import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { pick, uniqueDistractors } from './utils';

// Surds: simplifying sqrt(n) by extracting the largest square factor, multiplying
// and dividing surds, and adding/subtracting surd terms. Every instance is
// CONSTRUCTED backwards from the answer and never solved for:
//  - simplify draws n = a^2 * d with d square-free, so the answer is exactly a*sqrt(d);
//  - multiply draws the radicand product m^2 * d first, then splits it into two
//    non-square factors, so the merged root simplifies exactly;
//  - divide draws the radicand quotient k^2 * d first, then builds the dividend
//    k^2 * d * b, and only outer coefficients whose quotient p*k/q is a whole number;
//  - add/subtract either uses like terms directly, or draws two radicands m^2*d and
//    n^2*d that both reduce to the same surd first (the host topic's hard skill).
//
// Distractors are the named errors: swapping the coefficient and radicand, stopping
// at a partially simplified surd, adding or subtracting the radicands themselves
// (sqrt(A) - sqrt(B) = sqrt(A - B)), and adding coefficients where they should be
// multiplied (and vice versa).

const MODES = ['simplify', 'multiply', 'divide', 'add-subtract'] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Square-free radicands — the d in a*sqrt(d). */
  squarefree: z.array(z.number().int().min(2).max(30)).min(3),
  /** Extracted factors (the a in a*sqrt(d); also the merge/quotient factors). */
  multipliers: z.array(z.number().int().min(2).max(9)).min(2),
  /** Outer coefficients on the surd terms (1 = a bare surd). */
  coefficients: z.array(z.number().int().min(1).max(9)).min(1),
});
export type SurdParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface SurdValues {
  mode: Mode;
  /** add-subtract only: true when the radicands must be simplified first. */
  reduce: boolean;
  /** The square-free radicand of the answer. */
  d: number;
  /** simplify: the extracted factor a (radicand = a^2*d). multiply/divide: the merge/quotient factor. */
  a: number;
  /** The first (or only) radicand shown in the stem. */
  left: number;
  /** The second radicand shown (0 where unused). */
  right: number;
  /** Coefficient on the first term (numerator in divide). */
  p: number;
  /** Coefficient on the second term (denominator in divide). */
  q: number;
  /** add-subtract: true for subtraction. */
  minus: boolean;
}

const EMPTY: Omit<SurdValues, 'mode'> = {
  reduce: false,
  d: 0,
  a: 0,
  left: 0,
  right: 0,
  p: 0,
  q: 0,
  minus: false,
};

/** `3\sqrt{2}` — inner text, coefficient 1 suppressed. Callers wrap in `$...$`. */
function surdText(coef: number, rad: number): string {
  return coef === 1 ? `\\sqrt{${rad}}` : `${coef}\\sqrt{${rad}}`;
}

function isSquare(n: number): boolean {
  const r = Math.sqrt(n);
  return Number.isInteger(r);
}

export function draw(params: SurdParams, rng: Rng): SurdValues {
  const modes = params.modes ?? [...MODES];
  const squarefree = params.squarefree;
  const multipliers = [...new Set(params.multipliers)];
  const coefficients = params.coefficients;

  // multiply: (d, m, left, right) with left*right = m^2*d, both factors non-square.
  const multiplyCases: { d: number; m: number; left: number; right: number }[] = [];
  for (const d of squarefree) {
    for (const m of multipliers) {
      const target = m * m * d;
      for (let left = 2; left * left <= target; left++) {
        if (target % left !== 0) continue;
        const right = target / left;
        if (isSquare(left) || isSquare(right)) continue;
        if (right > 60) continue;
        multiplyCases.push({ d, m, left, right });
      }
    }
  }

  // divide: (d, b, k, p, q) with b != d and q | p*k, so the answer (p*k/q)*sqrt(d) is whole.
  // The dividend k^2*d*b is capped at 200 — a three-digit radicand is no longer a KS3 question.
  const divideCases: { d: number; b: number; k: number; p: number; q: number }[] = [];
  for (const d of squarefree) {
    for (const b of squarefree) {
      if (b === d) continue;
      for (const k of multipliers) {
        if (k * k * d * b > 200) continue;
        for (const p of coefficients) {
          for (const q of coefficients) {
            if ((p * k) % q === 0) divideCases.push({ d, b, k, p, q });
          }
        }
      }
    }
  }

  const feasible = modes.filter((mode) => {
    if (mode === 'simplify') return squarefree.length > 0 && multipliers.length > 0;
    if (mode === 'multiply') return multiplyCases.length > 0 && coefficients.length > 0;
    if (mode === 'divide') return divideCases.length > 0;
    // add-subtract: like terms need one coefficient; the reduce variant needs two
    // distinct multipliers, but the mode is feasible without it.
    return squarefree.length > 0 && coefficients.length > 0;
  });
  if (feasible.length === 0) {
    throw new Error('math-surds: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);

  if (mode === 'simplify') {
    const a = pick(multipliers, rng);
    const d = pick(squarefree, rng);
    return { ...EMPTY, mode, a, d, left: a * a * d };
  }

  if (mode === 'multiply') {
    const chosen = pick(multiplyCases, rng);
    const p = pick(coefficients, rng);
    const q = pick(coefficients, rng);
    return { ...EMPTY, mode, d: chosen.d, a: chosen.m, left: chosen.left, right: chosen.right, p, q };
  }

  if (mode === 'divide') {
    const chosen = pick(divideCases, rng);
    return {
      ...EMPTY,
      mode,
      d: chosen.d,
      a: chosen.k,
      left: chosen.k * chosen.k * chosen.d * chosen.b,
      right: chosen.b,
      p: chosen.p,
      q: chosen.q,
    };
  }

  // add-subtract: half the draws simplify-first (the harder skill), half like terms.
  const reduce = multipliers.length >= 2 && rng() < 0.5;
  const d = pick(squarefree, rng);
  const minus = rng() < 0.5;
  if (reduce) {
    const m = pick(multipliers, rng);
    const rest = multipliers.filter((v) => v !== m);
    const n = pick(rest, rng);
    let left = m * m * d;
    let right = n * n * d;
    if (minus && left < right) [left, right] = [right, left];
    return { ...EMPTY, mode, reduce: true, d, left, right, minus };
  }
  const p = pick(coefficients, rng);
  const others = coefficients.filter((c) => c !== p);
  const q = others.length > 0 ? pick(others, rng) : p;
  let first = p;
  let second = q;
  if (minus && first < second) [first, second] = [second, first];
  // A subtraction with equal coefficients would answer 0*sqrt(d); flip it to an addition.
  const effectiveMinus = minus && first !== second;
  return { ...EMPTY, mode, reduce: false, d, p: first, q: second, minus: effectiveMinus };
}

export function build(values: SurdValues, rng: Rng): GeneratorOutput {
  const { mode, reduce, d, a, left, right, p, q, minus } = values;

  if (mode === 'simplify') {
    const n = left;
    const correct = `$${surdText(a, d)}$`;
    const candidates: string[] = [
      // Coefficient and radicand swapped.
      `$${surdText(d, a)}$`,
    ];
    // Partially simplified forms (a smaller square factor extracted).
    if (a % 2 === 0) candidates.push(`$${surdText(a / 2, 4 * d)}$`);
    if (a % 3 === 0) candidates.push(`$${surdText(a / 3, 9 * d)}$`);
    candidates.push(`$${surdText(a + 1, d)}$`, `$${surdText(a, d * d)}$`);
    const pool: string[] = [];
    for (let k = 2; k <= 9; k++) for (const s of [2, 3, 5, 6, 7, 10, 15]) pool.push(`$${surdText(k, s)}$`);
    return {
      stem: `Simplify $\\sqrt{${n}}$ fully.`,
      correct,
      distractors: uniqueDistractors(correct, candidates, pool, rng),
      explanation: `Look for the largest square factor: $${n} = ${a * a} \\times ${d}$. Then $\\sqrt{${n}} = \\sqrt{${a * a}} \\times \\sqrt{${d}} = ${surdText(a, d)}$. A partially simplified form like a smaller coefficient still has a square factor left inside the root.`,
    };
  }

  if (mode === 'multiply') {
    const k = p * q * a;
    const correct = `$${surdText(k, d)}$`;
    const merged = left * right;
    const candidates = [
      // Coefficients multiplied but the merged root never simplified.
      `$${surdText(p * q, merged)}$`,
      // Coefficients added instead of multiplied.
      `$${surdText((p + q) * a, d)}$`,
      // The radicands added instead of multiplied.
      `$${surdText(k, left + right)}$`,
    ];
    const pool: string[] = [];
    for (let c = 2; c <= 12; c++) for (const s of [2, 3, 5, 6, 7, 10]) pool.push(`$${surdText(c, s)}$`);
    const coefText = p * q === 1 ? '' : String(p * q);
    return {
      stem: `Simplify $${surdText(p, left)} \\times ${surdText(q, right)}$.`,
      correct,
      distractors: uniqueDistractors(correct, candidates, pool, rng),
      explanation: `Multiply the coefficients and the radicands separately: $${surdText(p, left)} \\times ${surdText(q, right)} = ${coefText}\\sqrt{${merged}}$. Since $${merged} = ${a * a} \\times ${d}$, that root simplifies to $${a}\\sqrt{${d}}$, giving $${surdText(k, d)}$. The coefficients multiply — they do not add.`,
    };
  }

  if (mode === 'divide') {
    const r = (p * a) / q;
    const correct = `$${surdText(r, d)}$`;
    const quotient = a * a * d;
    const candidates = [
      // The wrong radicand kept (the denominator's).
      `$${surdText(r, right)}$`,
      // The radicands subtracted instead of divided.
      `$${surdText(r, Math.abs(left - right))}$`,
    ];
    // The radicand quotient left unsimplified: sqrt(k^2 d) instead of k*sqrt(d).
    if (q === 1) candidates.push(`$${surdText(p, quotient)}$`);
    else if (p % q === 0) candidates.push(`$${surdText(p / q, quotient)}$`);
    else candidates.push(`$${surdText(r + 1, d)}$`);
    const pool: string[] = [];
    for (let c = 1; c <= 9; c++) for (const s of [2, 3, 5, 6, 7, 10]) pool.push(`$${surdText(c, s)}$`);
    const pText = p === 1 ? '' : String(p);
    const qText = q === 1 ? '' : String(q);
    const coefStep = p === q ? '' : q === 1 ? `${p} \\times ` : `\\dfrac{${p}}{${q}} \\times `;
    return {
      stem: `Simplify $\\dfrac{${pText}\\sqrt{${left}}}{${qText}\\sqrt{${right}}}$.`,
      correct,
      distractors: uniqueDistractors(correct, candidates, pool, rng),
      explanation: `$\\dfrac{${pText}\\sqrt{${left}}}{${qText}\\sqrt{${right}}} = ${coefStep}\\sqrt{\\dfrac{${left}}{${right}}} = ${coefStep}\\sqrt{${quotient}}$, and $\\sqrt{${quotient}} = ${a}\\sqrt{${d}}$, so the answer is $${surdText(r, d)}$. The radicands divide — they do not subtract.`,
    };
  }

  // add-subtract
  if (reduce) {
    const m = Math.sqrt(left / d);
    const n = Math.sqrt(right / d);
    const c = minus ? m - n : m + n;
    const correct = `$${surdText(c, d)}$`;
    const combined = minus ? left - right : left + right;
    const candidates = [
      // Combined under a single root: sqrt(A) - sqrt(B) = sqrt(A - B).
      `$\\sqrt{${combined}}$`,
      // The wrong operation on the extracted coefficients.
      `$${surdText(minus ? m + n : Math.abs(m - n), d)}$`,
      // The unsimplified coefficients added straight away.
      `$${surdText(c, left)}$`,
    ];
    const pool: string[] = [];
    for (let k = 1; k <= 9; k++) for (const s of [2, 3, 5, 6, 7, 10]) pool.push(`$${surdText(k, s)}$`);
    const op = minus ? '-' : '+';
    return {
      stem: `Simplify $\\sqrt{${left}} ${op} \\sqrt{${right}}$.`,
      correct,
      distractors: uniqueDistractors(correct, candidates, pool, rng),
      explanation: `Simplify each surd first: $\\sqrt{${left}} = ${m}\\sqrt{${d}}$ and $\\sqrt{${right}} = ${n}\\sqrt{${d}}$. Then the like terms combine: $${m}\\sqrt{${d}} ${op} ${n}\\sqrt{${d}} = ${surdText(c, d)}$. You cannot combine the radicands under one root — $\\sqrt{A} ${op} \\sqrt{B}$ is not $\\sqrt{A ${op} B}$.`,
    };
  }

  const c = minus ? p - q : p + q;
  const correct = `$${surdText(c, d)}$`;
  const op = minus ? '-' : '+';
  const candidates = [
    // The radicands combined as well as the coefficients.
    `$${surdText(c, minus ? 0 : 2 * d)}$`,
    // The coefficients multiplied instead.
    `$${surdText(p * q, d)}$`,
    // The other operation on the coefficients.
    `$${surdText(minus ? p + q : Math.abs(p - q) === 0 ? p + q : Math.abs(p - q), d)}$`,
  ].filter((s) => !s.includes('\\sqrt{0}'));
  if (minus) candidates.push('$0$');
  const pool: string[] = [];
  for (let k = 1; k <= 12; k++) for (const s of [2, 3, 5, 6, 7, 10]) pool.push(`$${surdText(k, s)}$`);
  return {
    stem: `Simplify $${surdText(p, d)} ${op} ${surdText(q, d)}$.`,
    correct,
    distractors: uniqueDistractors(correct, candidates, pool, rng),
    explanation: `These are like terms — both are multiples of $\\sqrt{${d}}$ — so the coefficients combine: $${p}\\sqrt{${d}} ${op} ${q}\\sqrt{${d}} = (${p} ${op} ${q})\\sqrt{${d}} = ${surdText(c, d)}$. The radicand stays $\\sqrt{${d}}$; it does not double.`,
  };
}

export const mathSurds: QuestionGenerator<SurdParams> = {
  id: 'math-surds',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
