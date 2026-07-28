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
