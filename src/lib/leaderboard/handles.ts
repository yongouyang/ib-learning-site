// Phase D — pseudonymous handles (docs/leaderboard-plan.md §4.3).
// Each opted-in profile gets "{Adjective} {Animal}" generated DETERMINISTICALLY
// from the profileId, so it is stable across devices with zero extra storage
// (and computable in both Node and the browser — hence FNV-1a, not crypto).
// Positive adjectives only (docs/UX_GUIDELINES.md copy voice); no real names.

const ADJECTIVES = [
  'Brilliant', 'Curious', 'Brave', 'Clever', 'Eager', 'Swift', 'Bright', 'Bold',
  'Calm', 'Cheerful', 'Daring', 'Energetic', 'Fearless', 'Gentle', 'Happy',
  'Inventive', 'Jolly', 'Keen', 'Lively', 'Mighty', 'Nimble', 'Patient',
  'Playful', 'Quick', 'Radiant', 'Spirited', 'Steady', 'Thoughtful', 'Valiant',
  'Witty', 'Zesty', 'Ambitious', 'Careful', 'Diligent', 'Focused', 'Generous',
  'Honest', 'Ingenious', 'Joyful', 'Kind',
] as const;

const ANIMALS = [
  'Badger', 'Falcon', 'Otter', 'Fox', 'Owl', 'Panda', 'Tiger', 'Dolphin',
  'Hedgehog', 'Lynx', 'Puffin', 'Squirrel', 'Heron', 'Wolf', 'Bear', 'Eagle',
  'Koala', 'Lemur', 'Mole', 'Newt', 'Orca', 'Parrot', 'Quokka', 'Raven',
  'Seal', 'Tapir', 'Vole', 'Walrus', 'Yak', 'Zebra', 'Albatross', 'Beaver',
  'Cheetah', 'Deer', 'Elk', 'Frog', 'Gazelle', 'Hare', 'Iguana', 'Jay',
] as const;

/** 32-bit FNV-1a — stable across platforms, no imports needed. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic handle for a profileId: "Brilliant Badger". */
export function handleForProfile(profileId: string): string {
  const h = fnv1a(profileId);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length];
  return `${adjective} ${animal}`;
}

export const HANDLE_WORD_COUNTS = { adjectives: ADJECTIVES.length, animals: ANIMALS.length } as const;

// Custom handles (plan §4.3 "changeable once", D5): 2–24 chars, letters plus
// spaces/hyphens/apostrophes, a letter at both ends ("Mary-Jane O'Brien" yes;
// emoji/digits/leading punctuation no — handles appear on a public board).
// Shared by the auth zod schema (server) and the account page (client) — this
// module must stay browser-safe (pure TS, no node imports).
export const LEADERBOARD_HANDLE_RE = /^[A-Za-z][A-Za-z '-]{0,22}[A-Za-z]$/;

/** True when `value` (already trimmed) is an acceptable custom handle. */
export function isValidLeaderboardHandle(value: string): boolean {
  return LEADERBOARD_HANDLE_RE.test(value);
}
