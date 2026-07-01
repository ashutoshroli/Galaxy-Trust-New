/* Galaxy Trust service worker — enables installability + basic offline shell.
   Network-first (so users always get the latest build), cache as offline fallback.
   API requests are never cached.

   CACHE_VERSION is stamped by the Vite build (see vite.config.js) with the
   build timestamp, so every deploy gets a brand-new cache name. On
   activation, any cache from a previous deploy is deleted automatically —
   users never get stuck serving stale assets from an old build. */
const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE = `galaxy-trust-${CACHE_VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('galaxy-trust-') && name !== CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

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


/* ---- Web Push notifications ---- */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Galaxy Trust', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Galaxy Trust';
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { link: data.link || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(link).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
