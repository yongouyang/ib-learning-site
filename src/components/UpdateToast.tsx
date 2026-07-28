'use client';

import { useEffect, useRef, useState } from 'react';

// Watches the service worker registration for an *updated* worker sitting in
// `waiting` state (sw.js deliberately never calls skipWaiting on install, so
// a new version never activates mid-session). When one appears, shows a toast
// letting the user opt in: we message SKIP_WAITING to the waiting worker and
// reload once it takes control. Production only — no SW runs in dev.
export function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  // Reload ONLY after the user clicked Refresh. controllerchange also fires on
  // first install (clients.claim() in sw.js's activate handler) — reloading
  // then would yank the page from under a first-time visitor.
  const updateAccepted = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Capture the reference: cleanup must not depend on the global still
    // being there when the component unmounts.
    const serviceWorker = navigator.serviceWorker;
    let cancelled = false;

    const showIfWaiting = (registration: ServiceWorkerRegistration) => {
      // A waiting worker with no active controller is a first install, not an
      // update — nothing to prompt about.
      if (registration.waiting && serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
    };

    serviceWorker
      .getRegistration()
      .then((registration) => {
        if (cancelled || !registration) return;
        showIfWaiting(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') showIfWaiting(registration);
          });
        });
      })
      .catch(() => {
        // The site fully works without update prompts.
      });

    let refreshing = false;
    const onControllerChange = () => {
      if (!updateAccepted.current || refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-16 md:bottom-0 z-50 flex justify-center px-4 pb-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
        <span>A new version of IBLearn is ready.</span>
        <button
          type="button"
          onClick={() => {
            updateAccepted.current = true;
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          }}
          className="rounded-full bg-white/20 px-3 py-1 font-medium hover:bg-white/30 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
