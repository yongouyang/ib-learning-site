import { describe, it, expect, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OfflineBanner } from '@/components/OfflineBanner';

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('OfflineBanner', () => {
  afterEach(() => {
    setNavigatorOnLine(true);
  });

  it('renders nothing while online', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a notice when the browser is offline', () => {
    setNavigatorOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });

  it('appears when connectivity drops and disappears when it returns', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('can be dismissed and stays dismissed until connectivity returns', () => {
    setNavigatorOnLine(false);
    render(<OfflineBanner />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Coming back online resets the dismissal, so the next offline episode
    // shows the banner again.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });
});
