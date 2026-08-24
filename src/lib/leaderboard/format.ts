// Phase D6 — display formatting for the /leaderboard page (pure, unit-tested;
// lives in lib, not the page, so it can be tested without rendering).

/**
 * Localised reset-instant label: "Monday 9:00 AM"-style, in the VIEWER's
 * timezone and locale (the reset itself is Monday 00:00 UTC — plan §12 Q5).
 * Returns null for an unparseable input so the page can omit the line.
 */
export function formatResetLocal(resetAtIso: string): string | null {
  const d = new Date(resetAtIso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time}`;
}
