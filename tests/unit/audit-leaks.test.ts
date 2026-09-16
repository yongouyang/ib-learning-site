import { describe, expect, it } from 'vitest';
import { WINDOW, collectWindows, findPresentWindows, scanText, windowsFromText } from '../../scripts/audit-leaks';

// A detector that silently finds nothing is worse than no detector: these pin the three properties
// the leak gate (docs/premium-content-protection-plan.md §7) depends on.
describe('audit-leaks windows', () => {
  const long = 'Name the enzyme that digests starch, and state the optimum pH for its activity.';
  const doc = `some bundle noise ${long} more noise`;

  it('finds a planted content window', () => {
    expect(scanText(doc, collectWindows([long]))).toBe(long.slice(0, WINDOW));
  });

  it('ignores text with no shared window', () => {
    expect(scanText('an unrelated string that shares nothing with the corpus above', collectWindows([long]))).toBeNull();
  });

  it('matches a LaTeX-bearing line whose bundled form is backslash-escaped', () => {
    // The documented trap: the bundle stores \\dfrac where the parsed JSON holds \dfrac. Stripping
    // backslashes on BOTH sides is what makes this detectable — a raw grep returns a false "clean".
    const source = 'B1: (a) $4^{-2} = \\dfrac{1}{16}$ and therefore the reciprocal of the power.';
    const bundled = JSON.stringify(source);
    const windows = windowsFromText(source);
    expect(windows.size).toBeGreaterThan(0);
    expect(scanText(bundled, windows)).not.toBeNull();
  });

  it('ignores short lines so metadata cannot produce windows', () => {
    expect(windowsFromText('Angles — KS3 Year 7 Maths').size).toBe(0);
  });

  it('samples windows across the line, not just at its start', () => {
    // The regression this pins: a sentence shared mid-paragraph between a free topic and a premium
    // paper used to read as a premium-only leak, because only the line's first 48 chars became a
    // window and the free topic's line begins elsewhere.
    const shared = 'A waterfall forms where a layer of hard, resistant rock lies over softer rock.';
    const topicLine = `Rivers: ${shared} The soft rock is eroded faster.`;
    const topicWindows = windowsFromText(topicLine);
    const paperWindows = windowsFromText(shared);
    expect(topicWindows.size).toBeGreaterThan(1);
    // Every window of the shared sentence occurs in the free topic's line, so none of them is
    // premium-only.
    for (const w of paperWindows) expect(topicWindows.has(w)).toBe(true);
    expect(findPresentWindows(topicLine, paperWindows).size).toBe(paperWindows.size);
  });
});
