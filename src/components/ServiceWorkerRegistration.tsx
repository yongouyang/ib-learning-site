'use client';

import { useEffect } from 'react';

// Registers /sw.js once per page load. Production only, so it never fights
// `next dev` or Playwright's dev server; a failed registration is non-fatal.
// The window 'load' event can fire before React hydrates, so if the document
// is already complete we register immediately — waiting for 'load' would then
// never fire and the SW would silently never register.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The site fully works without a service worker.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
