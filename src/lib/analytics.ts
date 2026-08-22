import type { AnalyticsEventName } from './analytics/types';

// Phase A A3 — client analytics transport (docs/phase-a-analytics-plan.md).
// Fire-and-forget: events POST to /api/analytics/event via sendBeacon (with a
// fetch keepalive fallback) and NEVER throw into app code or surface errors —
// like the sync manager, failures are dropped silently (no retries, no queue:
// offline events are simply lost, an accepted trade-off in the plan).
// Attribution is ANONYMOUS ONLY (locked decision 3): a per-tab sessionStorage
// UUID, created lazily on the first event — nothing is read from localStorage
// progress. navigator.doNotTrack === '1' disables tracking entirely.
// SSR-safe: all window/navigator access happens inside functions, so importing
// this module server-side is a no-op.

const ENDPOINT = '/api/analytics/event';
const SESSION_KEY = 'octav_analytics_session';

// Used only when sessionStorage is unavailable (private mode) — a per-page-load
// id is still better than no session attribution.
let fallbackSessionId: string | null = null;

/** Per-tab session id: a sessionStorage UUID, created lazily on first use. */
function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    fallbackSessionId ??= crypto.randomUUID();
    return fallbackSessionId;
  }
}

/**
 * Send one event. `props` must match the server schema for `name`
 * (src/lib/analytics/types.ts) — the server rejects invalid envelopes with a
 * 400, which the client silently ignores.
 */
export function trackEvent(name: AnalyticsEventName, props: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (navigator.doNotTrack === '1') return;
  try {
    // Raw url/referrer — the server normalizes (path-only, host-only).
    const body = JSON.stringify({
      name,
      props,
      url: window.location.href,
      referrer: document.referrer,
      sessionId: getSessionId(),
      clientTs: new Date().toISOString(),
    });
    const beacon =
      typeof navigator.sendBeacon === 'function' ? navigator.sendBeacon.bind(navigator) : null;
    if (beacon?.(ENDPOINT, body)) return;
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: offline or server errors are dropped silently.
    });
  } catch {
    // Analytics must never throw into app code.
  }
}

/** Shorthand for the page_view event (no props). */
export function trackPageView(): void {
  trackEvent('page_view');
}
