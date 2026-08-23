'use client';

import { useEffect, useState } from 'react';
import { isDevEnvironment } from '@/lib/env';

/**
 * On dev environments swaps the favicon, apple-touch-icon, and manifest links
 * in the document head to their dev variants, then renders a fixed red border
 * overlay so the environment is unmistakable at a glance.
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

      // Swap favicon.
      const favicon = document.querySelector<HTMLLinkElement>(
        'link[rel="icon"][type="image/svg+xml"]',
      );
      if (favicon) {
        favicon.href = '/icons/icon-favicon-app-icon-dev.svg';
      }

      // Swap apple-touch-icon.
      const appleIcon = document.querySelector<HTMLLinkElement>(
        'link[rel="apple-touch-icon"]',
      );
      if (appleIcon) {
        appleIcon.href = '/icons/apple-touch-icon-dev.png';
      }

      // Swap manifest.
      const manifest = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]',
      );
      if (manifest) {
        manifest.href = '/manifest-dev.webmanifest';
      }
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