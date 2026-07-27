import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

describe('ServiceWorkerRegistration', () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker',
  );

  function mockServiceWorker(register?: ReturnType<typeof vi.fn>) {
    if (!register) {
      // Remove the key entirely so `'serviceWorker' in navigator` is false.
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
      return;
    }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
  }

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      // jsdom has no serviceWorker by default; restore that state.
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });

  it('does not register outside production', () => {
    const register = vi.fn().mockResolvedValue({});
    mockServiceWorker(register);

    render(<ServiceWorkerRegistration />);
    window.dispatchEvent(new Event('load'));

    expect(register).not.toHaveBeenCalled();
  });

  it('registers /sw.js on window load in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    mockServiceWorker(register);

    render(<ServiceWorkerRegistration />);
    window.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does not register before the load event in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    mockServiceWorker(register);

    render(<ServiceWorkerRegistration />);

    expect(register).not.toHaveBeenCalled();
  });

  it('no-ops when the browser has no service worker support', () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockServiceWorker(undefined);

    expect(() => {
      render(<ServiceWorkerRegistration />);
      window.dispatchEvent(new Event('load'));
    }).not.toThrow();
  });

  it('swallows a failed registration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockRejectedValue(new Error('denied'));
    mockServiceWorker(register);

    render(<ServiceWorkerRegistration />);
    window.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledWith('/sw.js');
    // Let the rejection settle; an unhandled rejection would fail the test run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
