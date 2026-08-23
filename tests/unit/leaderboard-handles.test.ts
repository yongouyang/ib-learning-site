import { describe, it, expect } from 'vitest';
import { HANDLE_WORD_COUNTS, handleForProfile, isValidLeaderboardHandle } from '@/lib/leaderboard/handles';

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

describe('isValidLeaderboardHandle (D5 — the one allowed custom change)', () => {
  it('accepts letters, spaces, hyphens and apostrophes within 2–24 chars', () => {
    for (const ok of ['Brilliant Badger', "Mary-Jane O'Brien", 'Bo', 'A'.repeat(24), '  Padded  '.trim()]) {
      expect(isValidLeaderboardHandle(ok), JSON.stringify(ok)).toBe(true);
    }
  });

  it('rejects digits, emoji, punctuation, and bad lengths', () => {
    for (const bad of [
      'A', // too short (1 char)
      'A'.repeat(25), // too long
      'x'.repeat(40),
      'Agent 007', // digits
      'Bad<script>', // angle brackets
      'Fire 🔥 Fox', // emoji
      'under_score', // underscore not allowed
      ' Leading', // must START with a letter
      'Trailing ', // must END with a letter (the schema trims first)
      "'Quoted'", // apostrophe at the ends
      'line\nbreak',
    ]) {
      expect(isValidLeaderboardHandle(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('every generated default handle passes the custom-handle rule', () => {
    // The merge logic treats "stored === deterministic default" as
    // changeable — that comparison only works if defaults are valid handles.
    for (let i = 0; i < 200; i++) {
      expect(isValidLeaderboardHandle(handleForProfile(`p${i}`))).toBe(true);
    }
  });
});
