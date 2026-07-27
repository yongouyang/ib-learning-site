'use client';

import { useEffect } from 'react';

// Registers /sw.js once per page load. Production only, so it never fights
// `next dev` or Playwright's dev server; a failed registration is non-fatal.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The site fully works without a service worker.
      });
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
