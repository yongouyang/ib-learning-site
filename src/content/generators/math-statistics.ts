import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { fmtNumber, pick, pickDistinct, shuffle, uniqueNumericDistractors } from './utils';

// List statistics: mean, median, mode, range, and "the mean is m, all but one of
// the values are shown". Answers are whole numbers BY CONSTRUCTION, because a
// mean of 7.333333 tests arithmetic rather than the statistic, and every
// authored item in the corpus is exact:
//
//  - mean: count-1 values are drawn, then the last is chosen so the total is
//    divisible by count. The schema guarantees max-min+1 >= count, so any
//    interval of that length contains one value per residue class — the draw
//    therefore cannot come up empty (no retry loop).
//  - median: `counts` must be ODD. The median of an even-sized set averages the
//    two middle values, which is a different (and harder) skill, so it is out of
//    scope here rather than approximated.
//  - mode: the modal value is placed 2-3 times and every other value appears
//    once, so the mode is unique. Two modes would make the question unanswerable.
//  - missing value: the shown values are built as pairs around the mean and sum
//    to mean*(count-1) - delta, so the hidden value is mean + delta — exact, and
//    deliberately NOT the mean itself.
//
// Distractors are the four mistakes students actually make: summing without
// dividing (mean), reading the middle of the UNSORTED list (median), and
// answering with the mean/median/max when the question asked for something else.

export const paramsSchema = z
  .object({
    modes: z
      .array(z.enum(['mean', 'median', 'mode', 'range', 'missing-value']))
      .min(1)
      .default(['mean', 'median', 'mode', 'range']),
    /** Set sizes. Must be odd — see the median note above. */
    counts: z.array(z.number().int().min(3).max(9)).min(1),
    min: z.number().int(),
    max: z.number().int(),
  })
  .refine((p) => p.max > p.min, { message: 'math-statistics: max must be greater than min' })
  .refine((p) => p.counts.every((c) => c % 2 === 1), {
    message: 'math-statistics: counts must be odd (the median of an even set is a different skill)',
  })
  .refine((p) => p.max - p.min + 1 >= Math.max(...p.counts), {
    message: 'math-statistics: the value range must hold at least as many distinct values as the largest set size',
  })
  .refine((p) => p.max - p.min >= 4, {
    message: 'math-statistics: the missing-value mode needs max - min >= 4',
  });
export type StatisticsParams = z.infer<typeof paramsSchema>;

type Mode = 'mean' | 'median' | 'mode' | 'range' | 'missing-value';

export interface StatisticsValues {
  mode: Mode;
  /** The list as displayed — deliberately unsorted, so a median question keeps its sorting step. */
  values: number[];
  answer: number;
  /** missing-value mode: how many values the list has in total. */
  total?: number;
  /** missing-value mode: the stated mean. */
  mean?: number;
}

const COUNT_WORD: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
};

export function draw(params: StatisticsParams, rng: Rng): StatisticsValues {
  // Normalise the schema defaults here too: `generate()` always parses first, but
  // unit tests and future callers pass a plain object straight to draw().
  const mode = pick(params.modes ?? ['mean', 'median', 'mode', 'range'], rng);
  const count = pick(params.counts, rng);
  const range: number[] = [];
  for (let v = params.min; v <= params.max; v++) range.push(v);
  const distinct = (n: number, exclude: number[] = []) =>
    pickDistinct(range.filter((v) => !exclude.includes(v)), n, rng);

  if (mode === 'range') {
    const values = distinct(count);
    return { mode, values, answer: Math.max(...values) - Math.min(...values) };
  }

  if (mode === 'median') {
    const values = distinct(count);
    const sorted = [...values].sort((a, b) => a - b);
    return { mode, values, answer: sorted[(count - 1) / 2] };
  }

  if (mode === 'mode') {
    const freq = count >= 5 ? 3 : 2;
    const modal = pick(range, rng);
    const values = shuffle([...Array<number>(freq).fill(modal), ...distinct(count - freq, [modal])], rng);
    return { mode, values, answer: modal };
  }

  if (mode === 'mean') {
    const picked = distinct(count - 1);
    const partial = picked.reduce((sum, v) => sum + v, 0);
    // A value v with (partial + v) % count === 0. The schema guarantees at least
    // one candidate exists for every residue class count (range length >= count).
    const residue = (count - (partial % count)) % count;
    const last = pick(
      range.filter((v) => v % count === residue),
      rng
    );
    const values = shuffle([...picked, last], rng);
    return { mode, values, answer: (partial + last) / count };
  }

  // missing-value: m must leave room for the +-2 pairs below.
  const mean = pick(
    range.filter((v) => v - 2 >= params.min && v + 2 <= params.max),
    rng
  );
  const delta = pick([-2, -1, 1, 2], rng);
  const pairs: number[] = [];
  for (let k = 1; k <= (count - 3) / 2; k++) pairs.push(mean - k, mean + k);
  // (mean - delta, mean) rather than another symmetric pair, so the hidden value
  // is mean + delta instead of the mean itself.
  const values = shuffle([...shuffle(pairs, rng), mean - delta, mean], rng);
  return { mode: 'missing-value', values, answer: mean + delta, total: count, mean };
}

function list(values: number[]): string {
  return `$${values.join(', ')}$`;
}

export function build(instance: StatisticsValues, rng: Rng): GeneratorOutput {
  const { mode, answer, total, mean } = instance;
  const values = instance.values;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  let stem: string;
  let candidates: number[];
  let explanation: string;

  if (mode === 'mean') {
    stem = `Find the mean of ${list(values)}.`;
    candidates = [sum, (min + max) / 2, sorted[(count - 1) / 2], answer + 2];
    explanation = `The sum is $${values.join(' + ')} = ${sum}$, and there are ${count} values, so the mean is $${sum} \\div ${count} = ${answer}$.`;
  } else if (mode === 'median') {
    stem = `Find the median of ${list(values)}.`;
    candidates = [values[(count - 1) / 2], Math.round(sum / count), max, answer + 2];
    explanation = `Arrange the values in order: ${list(sorted)}. The middle value is ${answer}, so the median is ${answer}.`;
  } else if (mode === 'mode') {
    const freq = values.filter((v) => v === answer).length;
    stem = `Find the mode of ${list(values)}.`;
    candidates = [Math.round(sum / count), sorted[(count - 1) / 2], max, answer + 2];
    explanation = `${answer} appears ${freq} times and every other value appears once, so the mode is ${answer}.`;
  } else if (mode === 'range') {
    stem = `Find the range of ${list(values)}.`;
    candidates = [max, min, max + min, answer + 2];
    explanation = `The largest value is ${max} and the smallest is ${min}, so the range is $${max} - ${min} = ${answer}$.`;
  } else {
    const all = total ?? count + 1;
    const stated = mean ?? 0;
    stem = `${COUNT_WORD[all]} numbers have a mean of $${stated}$. ${COUNT_WORD[count]} of them are ${list(values)}. What is the missing number?`;
    candidates = [stated, answer + 1, answer - 1, answer + 2];
    explanation = `The ${all} values total $${all} \\times ${stated} = ${all * stated}$. The ${count} shown values add to $${sum}$, so the missing number is $${all * stated} - ${sum} = ${answer}$.`;
  }

  const distractors = uniqueNumericDistractors(answer, candidates, rng).map((v) => fmtNumber(v)) as [
    string,
    string,
    string,
  ];
  return { stem, correct: fmtNumber(answer), distractors, explanation };
}

export const mathStatistics: QuestionGenerator<StatisticsParams> = {
  id: 'math-statistics',
  difficulty: 'easy',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
