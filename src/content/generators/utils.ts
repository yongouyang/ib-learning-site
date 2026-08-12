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

/**
 * String analogue of uniqueNumericDistractors: turn common-error candidate
 * strings into exactly three unique distractors, none equal to the correct
 * answer (exact string match after trimming; empties dropped). If the
 * candidates run out, pad from `fallbackPool` (a larger set of
 * plausible-but-wrong strings) in a deterministic rng-driven order. Throws if
 * candidates + fallbackPool cannot supply three distinct strings — that means
 * the params table is too small.
 */
export function uniqueDistractors(
  correct: string,
  candidates: string[],
  fallbackPool: string[],
  rng: Rng
): [string, string, string] {
  const used = new Set<string>([correct.trim()]);
  const picked: string[] = [];
  const consider = (raw: string): void => {
    if (picked.length === 3) return;
    const s = raw.trim();
    if (s === '' || used.has(s)) return;
    used.add(s);
    picked.push(s);
  };
  for (const candidate of candidates) consider(candidate);
  const pool = fallbackPool.filter((s) => {
    const t = s.trim();
    return t !== '' && !used.has(t);
  });
  while (picked.length < 3 && pool.length > 0) {
    const [s] = pool.splice(Math.floor(rng() * pool.length), 1);
    consider(s);
  }
  if (picked.length < 3) {
    throw new Error('uniqueDistractors: params table too small to supply three unique distractors');
  }
  return picked as [string, string, string];
}

/**
 * Aufbau shell filling for Z = 1..20: shells hold 2, 8, 8, then 4s takes the
 * rest (so K is 2,8,8,1 and Ca is 2,8,8,2). Returns the per-shell counts.
 */
export function aufbauShells(z: number): number[] {
  const caps = [2, 8, 8, 2];
  const shells: number[] = [];
  let remaining = z;
  for (const cap of caps) {
    if (remaining <= 0) break;
    shells.push(Math.min(cap, remaining));
    remaining -= cap;
  }
  return shells;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/** 35 -> "³⁵" (chemistry house style: unicode, not LaTeX). */
export function toSuperscript(n: number): string {
  return String(n).split('').map((d) => SUPERSCRIPT_DIGITS[d] ?? d).join('');
}

/** 2 -> "₂" (chemistry house style: unicode, not LaTeX). */
export function toSubscript(n: number): string {
  return String(n).split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('');
}

/** Ion charge notation: (1, '+') -> "⁺", (3, '-') -> "³⁻". */
export function chargeSuperscript(magnitude: number, sign: '+' | '-'): string {
  const digits = magnitude === 1 ? '' : toSuperscript(magnitude);
  return `${digits}${sign === '+' ? '⁺' : '⁻'}`;
}
