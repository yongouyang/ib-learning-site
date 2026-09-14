import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UpdateToast } from '@/components/UpdateToast';

type Listener = (event?: unknown) => void;

interface MockSW {
  listeners: Record<string, Listener[]>;
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  dispatch: (type: string) => void;
  getRegistration: ReturnType<typeof vi.fn>;
  controller: object | null;
}

function mockServiceWorker(): MockSW {
  const listeners: Record<string, Listener[]> = {};
  const sw: MockSW = {
    listeners,
    addEventListener: (type, listener) => {
      (listeners[type] ??= []).push(listener);
    },
    removeEventListener: (type, listener) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
    },
    dispatch: (type) => {
      (listeners[type] ?? []).forEach((l) => l());
    },
    getRegistration: vi.fn(),
    controller: { id: 'active-worker' },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: sw,
  });
  return sw;
}

function makeWorker(state = 'installed') {
  const listeners: Record<string, Listener[]> = {};
  return {
    state,
    postMessage: vi.fn(),
    listeners,
    addEventListener: (type: string, listener: Listener) => {
      (listeners[type] ??= []).push(listener);
    },
    setState(next: string) {
      this.state = next;
      (listeners['statechange'] ?? []).forEach((l) => l());
    },
  };
}

function makeRegistration(overrides: Record<string, unknown> = {}) {
  const listeners: Record<string, Listener[]> = {};
  return {
    waiting: null as ReturnType<typeof makeWorker> | null,
    installing: null as ReturnType<typeof makeWorker> | null,
    listeners,
    addEventListener: (type: string, listener: Listener) => {
      (listeners[type] ??= []).push(listener);
    },
    fireUpdateFound() {
      (listeners['updatefound'] ?? []).forEach((l) => l());
    },
    ...overrides,
  };
}

describe('UpdateToast', () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });

  it('renders nothing outside production', async () => {
    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a toast when an updated worker is waiting', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    expect(screen.getByRole('status')).toHaveTextContent(/new version/i);
  });

  it('ignores a waiting worker on first install (no active controller)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.controller = null;
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Refresh messages SKIP_WAITING to the waiting worker', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('surfaces an update that arrives while the page is open (updatefound)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const sw = mockServiceWorker();
    const registration = makeRegistration();
    sw.getRegistration.mockResolvedValue(registration);

    render(<UpdateToast />);
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    const installing = makeWorker('installing');
    registration.installing = installing;
    act(() => {
      registration.fireUpdateFound();
    });
    act(() => {
      installing.setState('installed');
    });
    // The now-installed worker becomes the waiting one.
    registration.waiting = installing;
    act(() => {
      installing.setState('installed');
    });

    expect(screen.getByRole('status')).toHaveTextContent(/new version/i);
  });

  it('does not reload on controllerchange before the user opts in (first-install claim)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    // First-install claim fires controllerchange without any user action —
    // the page must NOT reload by itself.
    act(() => {
      sw.dispatch('controllerchange');
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when the new worker takes control after clicking Refresh', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    const waiting = makeWorker();
    const sw = mockServiceWorker();
    sw.getRegistration.mockResolvedValue(makeRegistration({ waiting }));

    render(<UpdateToast />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    act(() => {
      sw.dispatch('controllerchange');
      sw.dispatch('controllerchange');
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

// A normal DEPLOY never touches sw.js (CACHE_VERSION is bumped only when the
// caching strategy changes), so the waiting-worker signal cannot see it. These
// cases pin the other signal: the deployed /version.json versus the id baked
// into the running bundle. Without it a stale PWA was indistinguishable from a
// fresh one — the exact confusion reported from an iPhone on 2026-09-14.
describe('UpdateToast — build change', () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'sha-running');
    // No SW at all: this signal must not depend on one.
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete (globalThis as { caches?: unknown }).caches;
    else (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  function stubVersion(id: string | null) {
    globalThis.fetch = vi.fn(async () =>
      id === null
        ? new Response('nope', { status: 404 })
        : new Response(JSON.stringify({ id, builtAt: '2026-09-14T00:00:00Z' }), { status: 200 })
    ) as unknown as typeof fetch;
  }

  it('warns when the deployed build differs from the running one', async () => {
    stubVersion('sha-deployed');
    render(<UpdateToast />);
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent(/new version/i);
  });

  it('stays silent when the deployed build is the one running', async () => {
    stubVersion('sha-running');
    render(<UpdateToast />);
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays silent when the version check fails (offline)', async () => {
    stubVersion(null);
    render(<UpdateToast />);
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Refresh clears Cache Storage before reloading, so the SW cannot replay the old build', async () => {
    stubVersion('sha-deployed');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
    const del = vi.fn(async () => true);
    (globalThis as { caches?: unknown }).caches = { keys: async () => ['iblearn-v1'], delete: del };

    render(<UpdateToast />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await act(async () => {});

    expect(del).toHaveBeenCalledWith('iblearn-v1');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
