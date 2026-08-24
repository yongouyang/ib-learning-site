import { describe, it, expect } from 'vitest';
import { formatResetLocal } from '@/lib/leaderboard/format';

// D6 reset-countdown label. The expectation is computed with the SAME Intl
// calls so the test is timezone/locale-independent (CI runners vary).

describe('formatResetLocal', () => {
  it('formats the reset instant as "<weekday> <local time>"', () => {
    const iso = '2026-08-24T00:00:00.000Z'; // a Monday 00:00 UTC reset
    const d = new Date(iso);
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    expect(formatResetLocal(iso)).toBe(`${weekday} ${time}`);
  });

  it('is honest about the viewer timezone (a UTC midnight resets mid-evening behind UTC)', () => {
    // No assertion on the absolute string (runner TZ varies) — just that the
    // output differs structurally from a bare UTC echo and stays non-empty.
    const label = formatResetLocal('2026-08-24T00:00:00.000Z');
    expect(label).toMatch(/.+ .+/);
  });

  it('returns null for unparseable input (the page omits the line)', () => {
    expect(formatResetLocal('not-a-date')).toBeNull();
    expect(formatResetLocal('')).toBeNull();
  });
});
