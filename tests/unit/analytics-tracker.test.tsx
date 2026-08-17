import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import { trackPageView } from '@/lib/analytics';

// Follows the existing component-test pattern (tests/unit/nav.test.tsx):
// next/navigation mocked with a mutable pathname, the analytics lib mocked so
// the test asserts the component's contract (when page_view fires), not the
// transport (covered in analytics-client.test.ts).

let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/lib/analytics', () => ({
  trackPageView: vi.fn(),
  trackEvent: vi.fn(),
}));

describe('AnalyticsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/';
  });

  it('renders nothing', () => {
    const { container } = render(<AnalyticsTracker />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires page_view on mount', () => {
    render(<AnalyticsTracker />);
    expect(trackPageView).toHaveBeenCalledTimes(1);
  });

  it('fires again on pathname change', () => {
    const { rerender } = render(<AnalyticsTracker />);
    expect(trackPageView).toHaveBeenCalledTimes(1);

    pathname = '/subjects/math';
    rerender(<AnalyticsTracker />);
    expect(trackPageView).toHaveBeenCalledTimes(2);
  });

  it('does not refire when the pathname is unchanged', () => {
    const { rerender } = render(<AnalyticsTracker />);
    rerender(<AnalyticsTracker />);
    expect(trackPageView).toHaveBeenCalledTimes(1);
  });

  it('does not fire on /admin paths', () => {
    pathname = '/admin/analytics';
    render(<AnalyticsTracker />);
    expect(trackPageView).not.toHaveBeenCalled();
  });
});
