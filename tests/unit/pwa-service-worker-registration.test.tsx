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

  it('registers /sw.js immediately when the document already loaded', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    mockServiceWorker(register);
    // jsdom's default readyState is 'complete' — hydration after window load
    // must not miss registration (the load event already fired).
    expect(document.readyState).toBe('complete');

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('defers to the load event while the document is still loading', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    mockServiceWorker(register);
    const originalReadyState = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });

    try {
      render(<ServiceWorkerRegistration />);
      expect(register).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('load'));
      expect(register).toHaveBeenCalledWith('/sw.js');
    } finally {
      if (originalReadyState) {
        Object.defineProperty(document, 'readyState', originalReadyState);
      }
    }
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
