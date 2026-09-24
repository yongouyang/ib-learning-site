import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, uniqueDistractors } from './utils';

// Linear inequalities: one-step, two-step, a bracketed inequality, a fractional one, a
// two-sided one, the integer solutions of a given inequality, and the two degenerate cases
// that have no solution or every value. Answers are constructed so the boundary is a whole
// number — a division that would not come out exactly is filtered at the draw rather than
// printed as a decimal — and the DIVISION BY A NEGATIVE is the point of the mode that has it:
// the direction of the sign must flip, which is the single most common error in this topic.
//
// Distractors are the named errors: forgetting to flip the sign, flipping it when the
// divisor was positive, moving a term without changing its sign, and reading "x > 5" where
// the question gives "x ≥ 5".

const MODES = [
  'one-step-add',
  'divide-by-negative',
  'two-step',
  'bracketed',
  'fractional',
  'two-sided',
  'integer-solutions',
  'no-solution',
] as const;

export const paramsSchema = z.object({
  modes: z.array(z.enum(MODES)).min(1).default([...MODES]),
  /** Integer boundaries the answers are built around. */
  values: z.array(z.number().int().min(2).max(25)).min(1),
  /** Coefficients for the two-step, bracketed and two-sided modes. */
  coefficients: z.array(z.number().int().min(2).max(8)).min(1),
  /** A second coefficient set, used where two different values are needed. */
  offsets: z.array(z.number().int().min(1).max(15)).min(1),
  /** Denominators for the fractional mode and the two-sided upper bound. */
  denominators: z.array(z.number().int().min(2).max(6)).min(1),
});
export type LinearInequalitiesParams = z.infer<typeof paramsSchema>;

type Mode = (typeof MODES)[number];

export interface InequalityValues {
  mode: Mode;
  /** The variable's name — kept as a field so the tests do not have to parse the stem. */
  variable: string;
  /** The solved boundary. */
  boundary: number;
  /** The direction of the solution: '>' or '<' (an inclusive comparison still uses '>' / '<'
   *  for the strictness test, with `inclusive` recording whether the boundary is included). */
  direction: '>' | '<';
  inclusive: boolean;
  /** Multipliers/offsets as they appeared in the question, for the explanation and the sweep. */
  a: number;
  b: number;
  c: number;
  /** Lower/upper bounds for the two-sided and integer-solutions modes. */
  low: number;
  high: number;
  /** The printed correct choice. */
  answer: string;
  /** The answer as a number (NaN for the list and degenerate modes). */
  answerValue: number;
}

const EMPTY: Omit<InequalityValues, 'mode' | 'answer' | 'answerValue'> = {
  variable: 'x',
  boundary: 0,
  direction: '>',
  inclusive: false,
  a: 0,
  b: 0,
  c: 0,
  low: 0,
  high: 0,
};

/** "$x > 5$" / "$x \\le 5$" — the strict symbol when the boundary is excluded. */
export function solveToLatex(direction: '>' | '<', inclusive: boolean, boundary: number): string {
  const symbol = direction === '>' ? (inclusive ? '\\ge' : '>') : inclusive ? '\\le' : '<';
  return `$x ${symbol} ${fmtNumber(boundary)}$`;
}

export function draw(params: LinearInequalitiesParams, rng: Rng): InequalityValues {
  const modes = params.modes ?? [...MODES];
  const values = params.values;
  const coefficients = params.coefficients;
  const offsets = params.offsets;
  const denominators = params.denominators;

  const feasible = modes.filter((mode) => {
    if (mode === 'divide-by-negative') return values.length > 0 && coefficients.length > 0;
    if (mode === 'two-step') return values.length > 0 && coefficients.length > 0 && offsets.length > 0;
    if (mode === 'bracketed') return values.length > 0 && coefficients.length > 0 && offsets.length > 0;
    if (mode === 'fractional') return values.length > 0 && offsets.length > 0 && denominators.length > 0;
    if (mode === 'two-sided') return values.length > 0 && coefficients.length > 0 && offsets.length > 0;
    if (mode === 'integer-solutions') return values.some((v) => v <= 6);
    if (mode === 'one-step-add') return values.length > 0 && offsets.length > 0;
    return true;
  });
  if (feasible.length === 0) {
    throw new Error('math-linear-inequalities: no mode is feasible for this param table');
  }
  const mode = pick(feasible, rng);
  const boundary = pick(values, rng);
  const a = pick(coefficients, rng);
  const b = pick(offsets, rng);

  if (mode === 'one-step-add') {
    // x + b > boundary  ->  x > boundary - b
    const answerBoundary = boundary - b;
    return {
      ...EMPTY,
      mode,
      b,
      boundary: answerBoundary,
      direction: '>',
      answer: solveToLatex('>', false, answerBoundary),
      answerValue: answerBoundary,
    };
  }

  if (mode === 'divide-by-negative') {
    // -a·x < a·boundary  ->  x > -boundary  (the sign flip IS the question)
    const answerBoundary = -boundary;
    return {
      ...EMPTY,
      mode,
      a,
      boundary: answerBoundary,
      direction: '>',
      answer: solveToLatex('>', false, answerBoundary),
      answerValue: answerBoundary,
    };
  }

  if (mode === 'two-step') {
    // The answer boundary IS the drawn value; the stem's right-hand side is built from it
    // (a·boundary + b), so the solution is whole for every parameter combination.
    return {
      ...EMPTY,
      mode,
      a,
      b,
      boundary,
      direction: '>',
      answer: solveToLatex('>', false, boundary),
      answerValue: boundary,
    };
  }

  if (mode === 'bracketed') {
    // a(x - b) < a·boundary  ->  x < boundary + b
    const answerBoundary = boundary + b;
    return {
      ...EMPTY,
      mode,
      a,
      b,
      boundary: answerBoundary,
      direction: '<',
      answer: solveToLatex('<', false, answerBoundary),
      answerValue: answerBoundary,
    };
  }

  if (mode === 'fractional') {
    // x/n + b > r  ->  x > n(r - b): pick n first so the answer is whole by construction.
    const n = pick(denominators, rng);
    const answerBoundary = n * (boundary - b);
    return {
      ...EMPTY,
      mode,
      a: n,
      b,
      boundary: answerBoundary,
      direction: '>',
      answer: solveToLatex('>', false, answerBoundary),
      answerValue: answerBoundary,
    };
  }

  if (mode === 'two-sided') {
    // The bounds are whole numbers by construction; the stem prints a·bound - b so both
    // ends of the given inequality are integers too.
    const lowBound = boundary;
    const highBound = boundary + 1;
    return {
      ...EMPTY,
      mode,
      a,
      b,
      low: lowBound,
      high: highBound,
      answer: `$${fmtNumber(lowBound)} \\le x < ${fmtNumber(highBound)}$`,
      answerValue: lowBound,
    };
  }

  if (mode === 'integer-solutions') {
    // low < x ≤ high, with small bounds because the whole list is printed in the answer.
    const small = pick(values.filter((v) => v <= 6), rng);
    const low = -small;
    const high = small;
    const list = Array.from({ length: high - low }, (_, i) => low + 1 + i).map((n) => fmtNumber(n));
    return {
      ...EMPTY,
      mode,
      low,
      high,
      answer: `$${list.join(', ')}$`,
      answerValue: NaN,
    };
  }

  // No solution: a·x + b < a·x - c has no x that satisfies it (the variable cancels and the
  // remaining statement is false). The distractors are the other verdicts a student can reach.
  return { ...EMPTY, mode, a, b, answer: 'no solution', answerValue: NaN };
}

export function build(values: InequalityValues, rng: Rng): GeneratorOutput {
  const { mode, a, b, boundary } = values;
  const answer = values.answer;

  /** The sign-flip error: the same boundary with the direction NOT reversed. */
  const unflipped = (direction: '>' | '<'): string => solveToLatex(direction, values.inclusive, boundary);

  if (mode === 'one-step-add') {
    return {
      stem: `Solve $x + ${fmtNumber(b)} > ${fmtNumber(boundary + b)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [unflipped('<'), solveToLatex('>', true, boundary), `$x > ${fmtNumber(-boundary)}$`],
        ['$x > 0$', '$x < 0$', '$x > 1$', '$x < 1$'],
        rng
      ),
      explanation: `Subtract $${fmtNumber(b)}$ from both sides: $x > ${fmtNumber(
        boundary + b
      )} - ${fmtNumber(b)} = ${fmtNumber(boundary)}$. Subtracting does not change the direction of the sign.`,
    };
  }

  if (mode === 'divide-by-negative') {
    return {
      stem: `Solve $${fmtNumber(-a)}x < ${fmtNumber(a * -boundary)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [unflipped('<'), solveToLatex('>', true, boundary), `$x < ${fmtNumber(-boundary)}$`],
        ['$x > 0$', '$x < 0$', '$x > 1$', '$x < 1$'],
        rng
      ),
      explanation: `Divide both sides by $${fmtNumber(-a)}$: $x > ${fmtNumber(
        -boundary
      )}$. Dividing by a NEGATIVE reverses the inequality sign — keeping $<$ here is the mistake this question is testing.`,
    };
  }

  if (mode === 'two-step') {
    const left = a * boundary + b;
    return {
      stem: `Solve $${fmtNumber(a)}x + ${fmtNumber(b)} > ${fmtNumber(left)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [unflipped('<'), solveToLatex('>', true, boundary), `$x > ${fmtNumber(boundary + b)}$`],
        ['$x > 0$', '$x < 0$', '$x > 1$'],
        rng
      ),
      explanation: `Subtract $${fmtNumber(b)}$: $${fmtNumber(a)}x > ${fmtNumber(
        left - b
      )}$. Then divide by $${fmtNumber(a)}$ (positive, so the sign stays the same): $x > ${fmtNumber(boundary)}$.`,
    };
  }

  if (mode === 'bracketed') {
    return {
      stem: `Solve $${fmtNumber(a)}(x - ${fmtNumber(b)}) < ${fmtNumber(a * boundary)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [unflipped('>'), solveToLatex('<', true, boundary), `$x < ${fmtNumber(boundary - b)}$`],
        ['$x < 0$', '$x > 0$', '$x > 1$'],
        rng
      ),
      explanation: `Divide both sides by $${fmtNumber(a)}$ first: $x - ${fmtNumber(b)} < ${fmtNumber(
        boundary
      )}$. Then add $${fmtNumber(b)}$: $x < ${fmtNumber(boundary + b)}$. Expanding the bracket first gives the same answer, but is easier to get wrong.`,
    };
  }

  if (mode === 'fractional') {
    const n = a;
    return {
      stem: `Solve $\\dfrac{x}{${fmtNumber(n)}} + ${fmtNumber(b)} > ${fmtNumber(boundary / n + b)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [unflipped('<'), solveToLatex('>', true, boundary), `$x > ${fmtNumber(boundary / n)}$`],
        ['$x > 0$', '$x < 0$', '$x > 1$'],
        rng
      ),
      explanation: `Subtract $${fmtNumber(b)}$ first: $\\dfrac{x}{${fmtNumber(n)}} > ${fmtNumber(
        boundary / n
      )}$. Then multiply by $${fmtNumber(n)}$: $x > ${fmtNumber(boundary)}$.`,
    };
  }

  if (mode === 'two-sided') {
    return {
      stem: `Solve $${fmtNumber(values.low * a - b)} \\le ${fmtNumber(a)}x - ${fmtNumber(
        b
      )} < ${fmtNumber(values.high * a - b)}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          `$${fmtNumber(values.high)} \\le x < ${fmtNumber(values.low)}$`,
          `$${fmtNumber(values.low)} < x \\le ${fmtNumber(values.high)}$`,
          `$${fmtNumber(values.low)} < x < ${fmtNumber(values.high)}$`,
        ],
        ['$0 \\le x < 1$', '$1 \\le x < 2$'],
        rng
      ),
      explanation: `Add $${fmtNumber(b)}$ to all three parts, then divide by $${fmtNumber(
        a
      )}$: $${fmtNumber(values.low)} \\le x < ${fmtNumber(values.high)}$. Both ends must keep their own comparison — the lower bound includes $x$ and the upper one does not.`,
    };
  }

  if (mode === 'integer-solutions') {
    const list: string[] = [];
    for (let n = values.low + 1; n <= values.high; n++) list.push(fmtNumber(n));
    return {
      stem: `List all the integer solutions of $${fmtNumber(values.low)} < x \\le ${fmtNumber(
        values.high
      )}$.`,
      correct: answer,
      distractors: uniqueDistractors(
        answer,
        [
          `$${[values.low, ...list].join(', ')}$`,
          `$${list.slice(0, -1).join(', ')}$`,
          `$${list.slice(1).join(', ')}$`,
        ],
        ['$0$', '$1, 2$', '$1, 2, 3$'],
        rng
      ),
      explanation: `The strict $<$ on the left EXCLUDES $${fmtNumber(values.low)}$, and the $\\le$ on the right INCLUDES $${fmtNumber(
        values.high
      )}$, so the integers are ${answer}.`,
    };
  }

  return {
    stem: `The solution set of $${fmtNumber(a)}x + ${fmtNumber(b)} < ${fmtNumber(a)}x - ${fmtNumber(
      b
    )}$ is:`,
    correct: answer,
    distractors: uniqueDistractors(
      answer,
      ['all values of $x$', '$x > 0$', 'exactly one solution'],
      ['$x = 0$', 'no integer solutions'],
      rng
    ),
    explanation: `Subtract $${fmtNumber(a)}x$ from both sides: $${fmtNumber(
      b
    )} < ${fmtNumber(-b)}$, which is false. When the variable cancels and the remaining statement is false, NO value of $x$ satisfies the inequality.`,
  };
}

export const mathLinearInequalities: QuestionGenerator<LinearInequalitiesParams> = {
  id: 'math-linear-inequalities',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
