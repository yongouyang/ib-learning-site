'use client';

import { useEffect, useRef, useState } from 'react';

// Watches TWO independent signals and offers one action:
//
//   1. an *updated* worker sitting in `waiting` state (sw.js deliberately never
//      calls skipWaiting on install, so a new version never activates
//      mid-session) — we message SKIP_WAITING and reload once it takes control;
//   2. a BUILD change — the deployed /version.json disagreeing with the id baked
//      into the bundle we are RUNNING. This is what a normal content deploy is,
//      and signal 1 cannot see it: sw.js only changes when the caching STRATEGY
//      changes (never per deploy), so before this the app was silent after every
//      deploy and a stale tab/PWA was indistinguishable from a fresh one.
//
// Production only — no SW runs in dev, and `next dev` has no version.json.

/**
 * Fetch the deployed build id, bypassing both cache layers. The query string is
 * what defeats CloudFront's 300s TTL for out/ objects; `no-store` covers the
 * browser's own HTTP cache.
 */
async function deployedBuildId(): Promise<string | null> {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
  return typeof body?.id === 'string' && body.id ? body.id : null;
}

/**
 * Drop every Cache Storage entry, then reload. A plain reload is not enough:
 * sw.js answers navigations from its cache first (stale-while-revalidate), so
 * "refresh" would hand back the very build the user is trying to leave. The SW
 * itself stays installed — it just has nothing cached, so the next load goes to
 * the network (and re-caches what it finds).
 */
async function reloadWithoutCaches() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // No Cache Storage (or a browser that forbids it here) — a plain reload is
    // still better than doing nothing.
  }
  window.location.reload();
}

export function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [buildStale, setBuildStale] = useState(false);
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

  // --- Signal 2: a build change --------------------------------------------
  //
  // Checked on mount and whenever the app becomes visible again (iOS PWAs are
  // resumed, not reloaded, so a deploy that landed while the app sat in the app
  // switcher is exactly the case that must be caught). A failed fetch is ignored:
  // being offline is the OfflineBanner's story, not this toast's.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    // Read inside the effect (not at module scope) so the value Next inlines is
    // the one the RUNNING bundle carries, and so tests can stub it per case.
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!buildId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const deployed = await deployedBuildId();
        if (!cancelled && deployed && deployed !== buildId) setBuildStale(true);
      } catch {
        // Offline or a blocked request — try again on the next visibility change.
      }
    };
    void check();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!waitingWorker && !buildStale) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-16 md:bottom-0 z-50 flex justify-center px-4 pb-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
        <span>A new version of Octav Learning is ready.</span>
        <button
          type="button"
          onClick={() => {
            if (waitingWorker) {
              updateAccepted.current = true;
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              return;
            }
            // Stale build: the worker is current, its CACHE is not.
            void reloadWithoutCaches();
          }}
          className="rounded-full bg-white/20 px-3 py-1 font-medium hover:bg-white/30 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
