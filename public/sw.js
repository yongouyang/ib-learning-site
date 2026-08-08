// IBLearn service worker — hand-rolled, no build step (see docs/phase-7-implementation-plan.md §3.2).
// Bump CACHE_VERSION manually when the caching *strategy* changes. Per-deploy
// invalidation is unnecessary: hashed assets never collide and SWR pages self-heal.
const CACHE_VERSION = 'iblearn-v1';
const PRECACHE_URLS = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // skipWaiting() is intentionally NOT called here — the update flow sends a
  // SKIP_WAITING message when the user opts in, so a new SW never activates
  // mid-session (e.g. while a student is mid-paper).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function cacheFirst(request) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
  );
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const network = fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches
            .match('/offline')
            .then((offline) => offline || Response.error());
        }
        return Response.error();
      });
    return cached || network;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // AI feedback must never be served stale — straight to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Content-hashed / immutable assets.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages, /images/**, and anything else: stale-while-revalidate, with an
  // /offline fallback for navigations that have no cached copy.
  event.respondWith(staleWhileRevalidate(request));
});
