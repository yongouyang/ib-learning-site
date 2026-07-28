// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Unit tests for the hand-rolled service worker (public/sw.js) with a mocked
// SW global environment. The /offline fallback for uncached navigations lives
// here rather than in e2e because Chromium's offline emulation does not apply
// to fetches made BY the service worker — the SW keeps reaching the network,
// so `context.setOffline(true)` cannot exercise that path in a browser.

const ORIGIN = 'https://iblearn.test';
const CACHE_VERSION = 'iblearn-v1'; // mirrors CACHE_VERSION in public/sw.js

type Listener = (event: never) => void;

const listeners: Record<string, Listener[]> = {};
const skipWaiting = vi.fn();
const claim = vi.fn();

let cacheStores: Map<string, Map<string, Response>>;
let cachesMock: {
  open: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
let fetchMock: ReturnType<typeof vi.fn<(input: Request | string) => Promise<Response>>>;

function createCachesMock() {
  cacheStores = new Map();
  return {
    open: vi.fn(async (name: string) => {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const store = cacheStores.get(name)!;
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls) {
            const absolute = new URL(url, ORIGIN).href;
            const response = await fetchMock(absolute);
            if (!response.ok) throw new Error(`precache failed: ${url}`);
            store.set(absolute, response);
          }
        },
        put: async (request: Request, response: Response) => {
          store.set(request.url, response);
        },
        match: async (request: Request) => store.get(request.url),
      };
    }),
    match: vi.fn(async (request: Request | string) => {
      // CacheStorage.match also accepts a plain URL string (sw.js uses
      // caches.match('/offline') in the fallback path).
      const url = typeof request === 'string' ? new URL(request, ORIGIN).href : request.url;
      for (const store of cacheStores.values()) {
        const hit = store.get(url);
        if (hit) return hit;
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...cacheStores.keys()]),
    delete: vi.fn(async (name: string) => cacheStores.delete(name)),
  };
}

function networkOk() {
  fetchMock.mockImplementation((input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url;
    return Promise.resolve(new Response(`network:${url}`, { status: 200 }));
  });
}

function networkDown() {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
}

async function fireInstall() {
  let pending: Promise<unknown> = Promise.resolve();
  for (const listener of listeners['install'] ?? []) {
    listener({ waitUntil: (p: Promise<unknown>) => (pending = p) } as never);
  }
  await pending;
}

async function fireActivate() {
  let pending: Promise<unknown> = Promise.resolve();
  for (const listener of listeners['activate'] ?? []) {
    listener({ waitUntil: (p: Promise<unknown>) => (pending = p) } as never);
  }
  await pending;
}

// Node's Request constructor rejects mode 'navigate' (only browsers create
// navigation requests) — patch the readonly getter instead.
function navigationRequest(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}

async function fireFetch(request: Request): Promise<Response | undefined> {
  let responded: Promise<Response> | undefined;
  const event = {
    request,
    respondWith: (r: Promise<Response>) => {
      responded = r;
    },
  };
  for (const listener of listeners['fetch'] ?? []) {
    listener(event as never);
  }
  return responded;
}

beforeAll(async () => {
  vi.stubGlobal('self', {
    addEventListener: (type: string, listener: Listener) => {
      (listeners[type] ??= []).push(listener);
    },
    skipWaiting,
    clients: { claim },
    location: { origin: ORIGIN },
  });
  // Side-effect import of a plain script (no exports) — registers the mocked
  // window-level listeners. Not a module, so tsc needs the suppression.
  // @ts-expect-error — public/sw.js is a classic script, not a module
  await import('../../public/sw.js');
});

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  cachesMock = createCachesMock();
  vi.stubGlobal('caches', cachesMock);
  skipWaiting.mockClear();
  claim.mockClear();
});

describe('service worker (public/sw.js)', () => {
  it('precaches / and /offline on install without skipping waiting', async () => {
    networkOk();
    await fireInstall();

    const store = cacheStores.get(CACHE_VERSION)!;
    expect(store.has(`${ORIGIN}/`)).toBe(true);
    expect(store.has(`${ORIGIN}/offline`)).toBe(true);
    // Updates must never activate mid-session — only via the SKIP_WAITING message.
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it('activates by deleting old caches and claiming clients', async () => {
    networkOk();
    await fireInstall();
    cacheStores.set('iblearn-v0-legacy', new Map());

    await fireActivate();

    expect(cacheStores.has('iblearn-v0-legacy')).toBe(false);
    expect(cacheStores.has(CACHE_VERSION)).toBe(true);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('skips waiting when told via the SKIP_WAITING message', () => {
    for (const listener of listeners['message'] ?? []) {
      listener({ data: { type: 'SKIP_WAITING' } } as never);
    }
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('never intercepts /api/** — network-only passthrough', async () => {
    networkOk();
    const responded = await fireFetch(new Request(`${ORIGIN}/api/feedback`));
    expect(responded).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores non-GET requests', async () => {
    networkOk();
    const responded = await fireFetch(new Request(`${ORIGIN}/`, { method: 'POST' }));
    expect(responded).toBeUndefined();
  });

  it('serves hashed static assets cache-first', async () => {
    networkOk();
    const url = `${ORIGIN}/_next/static/chunks/app-abc123.js`;

    const first = await fireFetch(new Request(url));
    expect(await first!.text()).toBe(`network:${url}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second hit comes from the cache without touching the network.
    const second = await fireFetch(new Request(url));
    expect(await second!.text()).toBe(`network:${url}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a cached page when the network is down (SWR)', async () => {
    networkOk();
    await fireFetch(new Request(`${ORIGIN}/`));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    networkDown();
    const offline = await fireFetch(new Request(`${ORIGIN}/`));
    expect(offline).toBeDefined();
    expect(await offline!.text()).toBe(`network:${ORIGIN}/`);
  });

  it('falls back to /offline for an uncached navigation while offline', async () => {
    networkOk();
    await fireInstall(); // precaches /offline
    networkDown();

    const responded = await fireFetch(navigationRequest(`${ORIGIN}/never-visited`));
    expect(responded).toBeDefined();
    expect(await responded!.text()).toBe(`network:${ORIGIN}/offline`);
  });

  it('returns Response.error() for a failed non-navigation fetch with no cache', async () => {
    networkDown();
    const responded = await fireFetch(new Request(`${ORIGIN}/images/math/foo.svg`));
    expect(responded).toBeDefined();
    expect(responded!.type).toBe('error');
  });
});
