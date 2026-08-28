'use client';

import { useEffect, useState } from 'react';
import { isDevEnvironment } from '@/lib/env';

/**
 * On dev environments renders a fixed red border overlay + DEV label so the
 * environment is unmistakable at a glance.
 *
 * The DEV-badged PWA manifest / favicon / touch-icon variants are served at
 * the CDN edge instead (dev_brand_rewrite in the site module's url_rewrite
 * CloudFront Function, dev distribution only). Mutating the metadata-managed
 * head links client-side fought Next's head reconciliation and left TWO
 * <link rel="manifest"> tags (pwa.spec.ts "manifest is served and linked").
 * localhost therefore keeps the prod icons — the rim is the local dev signal.
 *
 * In prod this component renders nothing and the effect is a no-op.
 *
 * Dev detection is deferred to a useEffect so the initial SSR render always
 * returns null — avoiding hydration mismatches between server (no window) and
 * client (localhost matches dev).
 */
export function DevEnvironmentIndicator() {
  const [dev, setDev] = useState(false);

  useEffect(() => {
    if (isDevEnvironment()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-side env detection
      setDev(true);
    }
  }, []);

  if (!dev) return null;

  return (
    <>
      {/* Red rim — fixed overlay, non-interactive. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[9999] border-[3px] border-red-500"
      />
      {/* DEV label — bottom-right corner. */}
      <div
        aria-hidden="true"
        className="fixed bottom-2 right-2 pointer-events-none z-[10000] bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded select-none"
      >
        DEV
      </div>
    </>
  );
}
