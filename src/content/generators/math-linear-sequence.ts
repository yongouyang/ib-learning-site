import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors, uniqueNumericDistractors } from './utils';

// Arithmetic (linear) sequences: the next term, the n-th term of a sequence or
// of a rule, which term equals a given value, and the common difference. Every
// answer is computed from the drawn difference and first term, so nothing can
// drift out of step with its own choices.
//
// Sequence terms are kept positive: for a descending sequence the first term is
// clamped up (`1 - a*6`), which is deterministic rather than a retry loop, so no
// draw can produce a KS3 sequence running through zero or below.
//
// Distractors are the named errors: using the first term as the constant (the
// classic `3n + 4` for 4, 7, 10, ...), off-by-one on the difference, reading the
// un-differenced term as "next", and answers one term out.

export const paramsSchema = z
  .object({
    /** Common differences. Negative values give descending sequences. */
    differences: z
      .array(z.number().int().min(-12).max(12))
      .min(1)
      .refine((values) => values.every((v) => v !== 0), {
        message: 'math-linear-sequence: a common difference of 0 is not an arithmetic sequence',
      }),
    /** First terms to draw from for the displayed sequences. */
    firstTerms: z.array(z.number().int().min(1).max(60)).min(1),
    /** Term positions (n) used by the n-th-term and which-term modes. */
    termIndices: z.array(z.number().int().min(3).max(20)).min(1),
    modes: z
      .array(z.enum(['next', 'nth-term', 'value-at-n', 'which-term', 'common-difference']))
      .min(1)
      .default(['next', 'nth-term', 'value-at-n', 'which-term', 'common-difference']),
  })
  .refine((p) => p.firstTerms.some((t) => t >= 1), {
    message: 'math-linear-sequence: firstTerms must contain a positive value',
  });
export type LinearSequenceParams = z.infer<typeof paramsSchema>;

type Mode = 'next' | 'nth-term' | 'value-at-n' | 'which-term' | 'common-difference';

export interface LinearSequenceValues {
  mode: Mode;
  /** Common difference. */
  a: number;
  /** First term of the displayed sequence (u_1). */
  first: number;
  /** The term position the question is about, where one is needed. */
  n?: number;
}

/** How many terms of the sequence are displayed in the stem. */
const SHOWN = 5;

export function draw(params: LinearSequenceParams, rng: Rng): LinearSequenceValues {
  // Normalise the schema default here too (see the phys-speed note): draw() is
  // called with a plain object by tests and by future callers.
  const modes = params.modes ?? ['next', 'nth-term', 'value-at-n', 'which-term', 'common-difference'];
  const mode = pick(modes, rng);
  const a = pick(params.differences, rng);
  // Clamp so every displayed term (and the "next" answer) is at least 1.
  const first = Math.max(pick(params.firstTerms, rng), 1 - a * (SHOWN + 1));
  // A descending sequence keeps its own constant (b = first - a) and the term
  // position is clamped instead: inflating b to keep u_n positive produced absurd
  // rules like `-3n + 46` for a question about the 15th term.
  const requested = pick(params.termIndices, rng);
  // (first - 5) rather than (first - 1): a target of exactly 1 ("which term equals 1?")
  // is degenerate, and the positivity clamp on `first` already guarantees u_3 >= 1.
  const highestPositive = a < 0 ? Math.max(3, Math.floor((first - 5) / -a) + 1) : requested;
  const n = Math.min(requested, highestPositive);
  return { mode, a, first, n };
}

/** u_k of the sequence drawn. */
function term(values: LinearSequenceValues, k: number): number {
  return values.first + values.a * (k - 1);
}

/** `3n + 1`, `3n`, `3n - 2`, `n + 4` — never `3n + 0`. */
function rule(a: number, b: number): string {
  const coefficient = a === 1 ? '' : a === -1 ? '-' : String(a);
  const constant = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`;
  return `$${coefficient}n${constant}$`;
}

function shownTerms(values: LinearSequenceValues, count: number): string {
  const terms = Array.from({ length: count }, (_, i) => term(values, i + 1));
  return `$${terms.join(', ')}, \\dots$`;
}

function stepWord(a: number): string {
  return a > 0 ? `up by $${a}$` : `down by $${Math.abs(a)}$`;
}

export function build(values: LinearSequenceValues, rng: Rng): GeneratorOutput {
  const { mode, a, first } = values;

  if (mode === 'next') {
    const next = term(values, SHOWN + 1);
    const last = term(values, SHOWN);
    const stem = `What is the next term in the sequence ${shownTerms(values, SHOWN)}?`;
    const distractors = uniqueNumericDistractors(
      next,
      [last, next + a, next - 1, next + 1, last + 2 * a],
      rng
    ).map((v) => fmtNumber(v)) as [string, string, string];
    const explanation = `The sequence goes ${stepWord(a)} each time: $${fmtNumber(last)} ${a > 0 ? '+' : '-'} ${Math.abs(a)} = ${fmtNumber(next)}$, so the next term is $${fmtNumber(next)}$.`;
    return { stem, correct: fmtNumber(next), distractors, explanation };
  }

  if (mode === 'nth-term') {
    const b = first - a;
    const correct = rule(a, b);
    const stem = `What is the $n$th term rule for the sequence ${shownTerms(values, SHOWN)}?`;
    const candidates = [rule(a, first), rule(a + 1, b), rule(a, b + 1), rule(a, b - 1), rule(a - 1, b)];
    const fallback = [rule(a, b + 2), rule(a + 2, b), rule(a + 1, b + 1), rule(a + 1, b - 1), rule(1, b)];
    const distractors = uniqueDistractors(correct, candidates, fallback, rng);
    const explanation = `The common difference is $${a}$, so start with $${a === 1 ? '' : a}n$. At $n = 1$ that gives $${a}$, but the first term is $${fmtNumber(first)}$, so the rule is ${correct}.`;
    return { stem, correct, distractors, explanation };
  }

  if (mode === 'value-at-n') {
    const n = values.n ?? 3;
    const b = first - a;
    const correct = a * n + b;
    const stem = `The $n$th term of a sequence is ${rule(a, b)}. What is the $${n}$th term?`;
    const distractors = uniqueNumericDistractors(
      correct,
      [a * n - b, a * (n + 1) + b, correct + a, correct - a],
      rng
    ).map((v) => fmtNumber(v)) as [string, string, string];
    const explanation = `Substitute $n = ${n}$: $${a === 1 ? '' : a}(${n})${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`} = ${fmtNumber(correct)}$.`;
    return { stem, correct: fmtNumber(correct), distractors, explanation };
  }

  if (mode === 'which-term') {
    const n = values.n ?? 3;
    const b = first - a;
    const target = a * n + b;
    const stem = `The $n$th term of a sequence is ${rule(a, b)}. Which term equals $${target}$?`;
    const distractors = uniqueNumericDistractors(
      n,
      [n + 1, n - 1, n + 2, Math.round(target / a)],
      rng
    ).map((v) => fmtNumber(v)) as [string, string, string];
    const explanation = `Set $${a === 1 ? '' : a}n${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`} = ${target}$. ${b === 0 ? '' : b > 0 ? `Subtract ${b}` : `Add ${Math.abs(b)}`}: $${a === 1 ? '' : a}n = ${target - b}$, then divide by $${a}$: $n = ${n}$. So the $${n}$th term is $${target}$.`;
    return { stem, correct: fmtNumber(n), distractors, explanation };
  }

  const shown = shownTerms(values, SHOWN - 1);
  const steps = Array.from({ length: SHOWN - 2 }, (_, i) => term(values, i + 2) - term(values, i + 1));
  const consistent = steps.every((s) => s === a);
  const stem = `Find the common difference of the sequence ${shown}.`;
  const distractors = uniqueNumericDistractors(a, [-a, a + 1, a - 1, a + 2], rng).map((v) =>
    fmtNumber(v)
  ) as [string, string, string];
  const explanation = consistent
    ? a > 0
      ? `Each term is found by adding $${a}$: $${fmtNumber(term(values, 2))} - ${fmtNumber(term(values, 1))} = ${a}$.`
      : `Each term is found by subtracting $${Math.abs(a)}$: $${fmtNumber(term(values, 1))} - ${fmtNumber(term(values, 2))} = ${Math.abs(a)}$, so the common difference is $${a}$.`
    : `The terms change by the same amount each time, so the common difference is $${a}$.`;
  return { stem, correct: fmtNumber(a), distractors, explanation };
}

export const mathLinearSequence: QuestionGenerator<LinearSequenceParams> = {
  id: 'math-linear-sequence',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
