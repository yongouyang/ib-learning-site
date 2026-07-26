import type { Difficulty, Question } from '@/content/types';

// Simple string hash for deterministic seeds.
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Deterministic Fisher-Yates shuffle so server and client render match.
// When no seed is supplied the order is left unchanged, which is safe for SSR.
export function seededShuffle<T>(items: T[], seed?: string): T[] {
  if (!seed) return items;
  const result = [...items];
  let state = hashString(seed);
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const DIFFICULTY_LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

export type DifficultyFilter = Difficulty | 'all';

// Untagged questions sort as medium (transitional; all questions are tagged post-Phase-2).
function bandOf(item: { difficulty?: Difficulty }): Difficulty {
  return item.difficulty ?? 'medium';
}

// Easy -> hard ordering with a deterministic shuffle WITHIN each band, so a
// quiz ramps up in difficulty without asking questions in the exact same
// order every attempt. Untagged questions are treated as medium. Works for
// both MC questions and free-response questions (anything difficulty-tagged).
export function orderQuestionsByDifficulty<T extends { difficulty?: Difficulty }>(
  questions: T[],
  seed: string
): T[] {
  const bands = new Map<Difficulty, T[]>();
  for (const level of DIFFICULTY_LEVELS) bands.set(level, []);
  for (const question of questions) {
    bands.get(bandOf(question))!.push(question);
  }
  return DIFFICULTY_LEVELS.flatMap((level) =>
    seededShuffle(bands.get(level)!, `${seed}:${level}`)
  );
}

export function filterQuestionsByDifficulty(
  questions: Question[],
  filter: DifficultyFilter
): Question[] {
  if (filter === 'all') return questions;
  return questions.filter((q) => bandOf(q) === filter);
}

export function parseDifficultyFilter(value: string | null): DifficultyFilter {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'all';
}

// Stratified random sample: pick `targets[level]` items from each difficulty
// band (untagged counts as medium). When a band runs short, the deficit is
// filled from the leftovers of all bands so the total is still reached.
// Non-deterministic (Math.random) — for quiz-session sampling, not SSR.
export function stratifiedSample<T>(
  pool: T[],
  targets: Partial<Record<Difficulty, number>>,
  getDifficulty: (item: T) => Difficulty | undefined = (item) =>
    (item as { difficulty?: Difficulty }).difficulty
): T[] {
  const total = Object.values(targets).reduce((sum, n) => sum + n, 0);
  const bands: Record<Difficulty, T[]> = { easy: [], medium: [], hard: [] };
  for (const item of pool) bands[getDifficulty(item) ?? 'medium'].push(item);
  for (const level of DIFFICULTY_LEVELS) {
    bands[level].sort(() => Math.random() - 0.5);
  }
  const picked: T[] = [];
  const leftovers: T[] = [];
  for (const level of DIFFICULTY_LEVELS) {
    const want = targets[level] ?? 0;
    picked.push(...bands[level].slice(0, want));
    leftovers.push(...bands[level].slice(want));
  }
  leftovers.sort(() => Math.random() - 0.5);
  return [...picked, ...leftovers].slice(0, total);
}
