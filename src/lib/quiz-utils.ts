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

// mulberry32 PRNG seeded from hashString — pure 32-bit integer arithmetic via
// Math.imul/>>>, so low bits mix properly. (The previous LCG did
// `state * 1103515245` in double precision: for typical hashes the product
// exceeds 2^53 and the low ~8 bits were rounded to zero, so state % 2 was
// ALWAYS 0 and two-item arrays never actually shuffled.)
// Deterministic per seed — drives both seededShuffle and the question-template
// generators (src/lib/generators.ts).
export function createRng(seed: string): () => number {
  let state = hashString(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher-Yates shuffle so server and client render match.
// When no seed is supplied the order is left unchanged, which is safe for SSR.
export function seededShuffle<T>(items: T[], seed?: string): T[] {
  if (!seed) return items;
  const result = [...items];
  const random = createRng(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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

// --- Variant groups (docs/question-variations-plan.md) ---
// Questions sharing a `variantOf` key are isomorphic variants of one skill.
// A quiz session samples ONE question per group (ungrouped questions are
// singleton groups, so they are always included), giving a fresh mix on every
// retake while keeping full skill coverage.

export function groupKeyOf(question: Pick<Question, 'id' | 'variantOf'>): string {
  return question.variantOf ?? `solo:${question.id}`;
}

export function hasVariantGroups(questions: Pick<Question, 'variantOf'>[]): boolean {
  return questions.some((q) => q.variantOf !== undefined);
}

// One randomly-picked (seeded) member per variant group. Group membership is
// derived from array order, so the result order matches first occurrence of
// each group in the input — compose with orderQuestionsByDifficulty for the
// easy->hard ramp.
export function sampleVariantGroups(questions: Question[], seed: string): Question[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const key = groupKeyOf(q);
    const members = groups.get(key);
    if (members) members.push(q);
    else groups.set(key, [q]);
  }
  return Array.from(groups, ([key, members]) => seededShuffle(members, `${seed}:${key}`)[0]);
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
