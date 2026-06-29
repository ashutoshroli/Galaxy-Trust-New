/* Galaxy Trust service worker — enables installability + basic offline shell.
   Network-first (so users always get the latest build), cache as offline fallback.
   API requests are never cached. */
const CACHE = 'galaxy-trust-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API calls
  if (url.pathname.startsWith('/api/') || url.href.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match('/')))
  );
});
