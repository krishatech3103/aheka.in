// Aheka Service Worker (sw.js)
const CACHE_NAME = 'aheka-v1.0.0';
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// Sensitive path prefixes that MUST NEVER be cached
const NEVER_CACHE_PREFIXES = [
  '/admin',
  '/vendor',
  '/api',
  '/auth',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Strictly NEVER cache private or administrative paths
  for (const prefix of NEVER_CACHE_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      return;
    }
  }

  // HTML page navigations: Network First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // Static assets (CSS, JS, Webmanifest, Icons): Stale While Revalidate
  if (url.pathname.startsWith('/_astro/') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});
