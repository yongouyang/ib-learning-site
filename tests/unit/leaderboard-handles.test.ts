import { describe, it, expect } from 'vitest';
import { HANDLE_WORD_COUNTS, handleForProfile } from '@/lib/leaderboard/handles';

// Pseudonymous handles (docs/leaderboard-plan.md §4.3): deterministic from the
// profileId (stable across devices, zero extra storage), "{Adjective} {Animal}",
// no real names.

describe('handleForProfile', () => {
  it('is deterministic — same profileId, same handle', () => {
    expect(handleForProfile('prof-abc123')).toBe(handleForProfile('prof-abc123'));
  });

  it('produces "{Adjective} {Animal}" in display form', () => {
    for (const id of ['prof-abc123', 'child_01', 'XYZ-789']) {
      expect(handleForProfile(id)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });

  it('distributes distinct profiles across the word space', () => {
    // 40 adjectives × 40 animals = 1600 combinations; 1000 sequential profile
    // ids should land on a large fraction of them (≈740 expected). A low bar
    // guards against a broken hash collapsing to a handful of handles.
    const handles = new Set(Array.from({ length: 1000 }, (_, i) => handleForProfile(`p${i}`)));
    expect(handles.size).toBeGreaterThan(400);
  });

  it('pins the word-list sizes the distribution test assumes', () => {
    expect(HANDLE_WORD_COUNTS).toEqual({ adjectives: 40, animals: 40 });
  });
});
