import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { InstallAppButton } from '@/components/InstallAppButton';
import type { BeforeInstallPromptEvent } from '@/hooks/useInstallPrompt';

function stubMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function stubUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: ua,
  });
}

function fakePromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';

describe('InstallAppButton', () => {
  let originalUA: string;

  beforeEach(() => {
    originalUA = navigator.userAgent;
    stubMatchMedia(false);
    stubUserAgent(DESKTOP_UA);
  });

  afterEach(() => {
    stubUserAgent(originalUA);
  });

  it('renders nothing without an install prompt on desktop', () => {
    render(<InstallAppButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the button once the browser fires beforeinstallprompt', () => {
    render(<InstallAppButton />);
    act(() => {
      window.dispatchEvent(fakePromptEvent('accepted'));
    });
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });

  it('triggers the captured prompt on click and hides after acceptance', async () => {
    render(<InstallAppButton />);
    const event = fakePromptEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    expect(event.prompt).toHaveBeenCalledTimes(1);

    // userChoice resolves async; after acceptance the button disappears.
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
  });

  it('keeps the button when the user dismisses the browser prompt', async () => {
    render(<InstallAppButton />);
    const event = fakePromptEvent('dismissed');
    act(() => {
      window.dispatchEvent(event);
    });

    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument();
  });

  it('renders nothing when the app is already installed (standalone)', () => {
    stubMatchMedia(true);
    render(<InstallAppButton />);
    act(() => {
      window.dispatchEvent(fakePromptEvent('accepted'));
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('on iOS shows manual Share → Add to Home Screen instructions', () => {
    stubUserAgent(IPHONE_UA);
    render(<InstallAppButton />);

    const button = screen.getByRole('button', { name: /install app/i });
    expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
