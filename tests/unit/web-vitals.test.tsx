import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WebVitals } from '@/components/WebVitals';
import { trackEvent } from '@/lib/analytics';

const { useReportWebVitals } = vi.hoisted(() => ({ useReportWebVitals: vi.fn() }));

vi.mock('next/web-vitals', () => ({ useReportWebVitals }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

type Callback = Parameters<typeof import('next/web-vitals').useReportWebVitals>[0];
type Metric = Parameters<Callback>[0];

function metric(overrides: Record<string, unknown> = {}): Metric {
  return {
    name: 'LCP',
    value: 1234.5,
    rating: 'good',
    navigationType: 'navigate',
    navigationURL: 'https://octavlearning.com/subjects/math?x=1',
    ...overrides,
  } as Metric;
}

describe('WebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers one stable callback and renders nothing', () => {
    const { container, rerender } = render(<WebVitals />);
    const callback = useReportWebVitals.mock.calls[0][0];
    rerender(<WebVitals />);

    expect(container).toBeEmptyDOMElement();
    expect(useReportWebVitals).toHaveBeenCalledTimes(2);
    expect(useReportWebVitals.mock.calls[1][0]).toBe(callback);
  });

  it('reports supported metrics with their navigation URL', () => {
    render(<WebVitals />);
    const callback = useReportWebVitals.mock.calls[0][0];
    callback(metric());

    expect(trackEvent).toHaveBeenCalledWith('page_performance', {
      metric: 'LCP',
      value: 1234.5,
      rating: 'good',
      navigationType: 'navigate',
    }, { url: 'https://octavlearning.com/subjects/math?x=1' });
  });

  it('skips admin paths, custom metrics and malformed navigation URLs', () => {
    render(<WebVitals />);
    const callback = useReportWebVitals.mock.calls[0][0];
    callback(metric({ navigationURL: 'https://octavlearning.com/admin/analytics' }));
    callback(metric({ name: 'Next.js-hydration' }));
    callback(metric({ navigationURL: 'not a URL' }));

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
