import type { Rng } from './types';

// Shared helpers for the question generators. Everything is deterministic:
// all randomness comes from the seeded rng passed in.

/** Clean numeric formatting — integers stay integers, no float noise (0.30000000000000004 -> "0.3"). */
export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** Draw `count` distinct items (without replacement). */
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let k = 0; k < count && pool.length > 0; k++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/**
 * Turn common-error candidate values into exactly three unique distractors,
 * none equal to the correct answer (compared on their formatted form, so
 * 2.5 and 2.5000000001 collide as they should). Non-finite candidates are
 * dropped. If the candidates run out (a collision-heavy param draw), the
 * correct value is nudged by deterministic rng-chosen offsets as a safety net.
 */
export function uniqueNumericDistractors(
  correct: number,
  candidates: number[],
  rng: Rng
): [number, number, number] {
  const used = new Set<string>([fmtNumber(correct)]);
  const picked: number[] = [];
  for (const candidate of candidates) {
    if (picked.length === 3) break;
    if (!Number.isFinite(candidate)) continue;
    const key = fmtNumber(candidate);
    if (used.has(key)) continue;
    used.add(key);
    picked.push(candidate);
  }
  let step = 1;
  while (picked.length < 3) {
    const offset = rng() < 0.5 ? -step : step;
    step += 1;
    const candidate = correct + offset;
    const key = fmtNumber(candidate);
    if (used.has(key)) continue;
    used.add(key);
    picked.push(candidate);
  }
  return picked as [number, number, number];
}
