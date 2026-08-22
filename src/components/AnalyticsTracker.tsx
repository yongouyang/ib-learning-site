'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

// Phase A A3 — fires a page_view on mount and on every client-side pathname
// change (docs/phase-a-analytics-plan.md). /admin paths are skipped: the A5
// dashboard is internal tooling, not site traffic. Renders nothing; mounted
// once in the root layout.
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    trackPageView();
  }, [pathname]);

  return null;
}
