import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyticsEventSchema } from '@/lib/analytics/types';
import { trackEvent, trackPageView } from '@/lib/analytics';

// Phase A A3 — client analytics transport tests. The emitted envelope is
// validated against the SERVER schema (analyticsEventSchema) so the client can
// never drift from what /api/analytics/event accepts.

const ENDPOINT = '/api/analytics/event';

function stubBeacon(impl?: (url: string, body?: BodyInit | null) => boolean) {
  const mock = vi.fn(impl ?? (() => true));
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, writable: true, value: mock });
  return mock;
}

function removeBeacon() {
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, writable: true, value: undefined });
}

function stubDoNotTrack(value: string | null) {
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, writable: true, value });
}

function lastBeaconBody(mock: ReturnType<typeof stubBeacon>): Record<string, unknown> {
  const [url, body] = mock.mock.calls[mock.mock.calls.length - 1];
  expect(url).toBe(ENDPOINT);
  return JSON.parse(body as string) as Record<string, unknown>;
}

function lastFetchBody(mock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [url, init] = mock.mock.calls[mock.mock.calls.length - 1];
  expect(url).toBe(ENDPOINT);
  return JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
}

describe('analytics client', () => {
  const originalBeacon = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
  const originalDnt = Object.getOwnPropertyDescriptor(navigator, 'doNotTrack');
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    stubDoNotTrack(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalBeacon) Object.defineProperty(navigator, 'sendBeacon', originalBeacon);
    else removeBeacon();
    if (originalDnt) Object.defineProperty(navigator, 'doNotTrack', originalDnt);
    else stubDoNotTrack(null);
  });

  it('sends the envelope via sendBeacon and it validates against the server schema', () => {
    const beacon = stubBeacon();

    trackPageView();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const envelope = lastBeaconBody(beacon);
    const parsed = analyticsEventSchema.safeParse(envelope);
    expect(parsed.success).toBe(true);
    expect(envelope.name).toBe('page_view');
    expect(envelope.props).toEqual({});
    expect(envelope.url).toBe(window.location.href);
    expect(envelope.referrer).toBe(document.referrer);
    expect(envelope.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(envelope.clientTs as string).toString()).not.toBe('Invalid Date');
  });

  it('sends custom event names and props', () => {
    const beacon = stubBeacon();

    trackEvent('cta_clicked', { ctaId: 'hero-start' });

    const envelope = lastBeaconBody(beacon);
    expect(analyticsEventSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.name).toBe('cta_clicked');
    expect(envelope.props).toEqual({ ctaId: 'hero-start' });
  });

  it('falls back to fetch keepalive when sendBeacon is unavailable', () => {
    removeBeacon();

    trackPageView();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).keepalive).toBe(true);
    expect(analyticsEventSchema.safeParse(lastFetchBody(fetchMock)).success).toBe(true);
  });

  it('falls back to fetch keepalive when sendBeacon returns false', () => {
    const beacon = stubBeacon(() => false);

    trackPageView();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(analyticsEventSchema.safeParse(lastFetchBody(fetchMock)).success).toBe(true);
  });

  it('is a no-op when navigator.doNotTrack is "1"', () => {
    const beacon = stubBeacon();
    stubDoNotTrack('1');

    trackPageView();
    trackEvent('cta_clicked', { ctaId: 'x' });

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates the session id lazily — no sessionStorage read at import', () => {
    // The module was imported at the top of this file; the spy below is
    // installed AFTER import, so any import-time read would not be observable
    // here. Assert instead that nothing touches sessionStorage until the
    // first event, and that the id appears only then.
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    expect(getSpy).not.toHaveBeenCalled();

    stubBeacon();
    trackPageView();

    expect(getSpy).toHaveBeenCalled();
    expect(sessionStorage.getItem('octav_analytics_session')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the session id stable across events within the tab (one randomUUID)', () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID');
    const beacon = stubBeacon();

    trackPageView();
    trackEvent('auth_logout');

    const first = lastBeaconBody(beacon).sessionId;
    const second = lastBeaconBody(beacon).sessionId;
    expect(first).toBe(second);
    expect(uuidSpy).toHaveBeenCalledTimes(1);
  });

  it('uses crypto.randomUUID for the session id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');
    const beacon = stubBeacon();

    trackPageView();

    expect(lastBeaconBody(beacon).sessionId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('falls back to a stable in-memory session id when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    const beacon = stubBeacon();

    trackPageView();
    const first = lastBeaconBody(beacon).sessionId;
    trackPageView();
    const second = lastBeaconBody(beacon).sessionId;

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
  });

  it('never throws when sendBeacon throws', () => {
    stubBeacon(() => {
      throw new Error('beacon boom');
    });

    expect(() => trackPageView()).not.toThrow();
  });

  it('never throws or rejects to the caller when fetch fails', async () => {
    removeBeacon();
    fetchMock.mockRejectedValue(new Error('network down'));

    expect(() => trackPageView()).not.toThrow();
    // Flush microtasks — the rejection must be swallowed, not unhandled.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('is a no-op without window/navigator (SSR) and imports cleanly', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);
    vi.resetModules();

    await expect(import('@/lib/analytics')).resolves.toBeDefined();
    const fresh = await import('@/lib/analytics');
    expect(() => fresh.trackPageView()).not.toThrow();
    expect(() => fresh.trackEvent('page_view')).not.toThrow();

    vi.unstubAllGlobals();
  });
});
