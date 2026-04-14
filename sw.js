/**
 * Luz Estelar Oficial — Service Worker
 * Enables offline access and installable PWA experience.
 * Strategy: Network-first with cache fallback for pages,
 * Cache-first for static assets (fonts, images, CSS).
 */

const CACHE_NAME = 'luzestelar-v3';
const OFFLINE_URL = '/offline.html';
const READING_CACHE = 'luzestelar-reading-v1';

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/mi-dia.html',
  '/app_icon.png',
  '/manifest.json',
  OFFLINE_URL,
];

// Install: precache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  const KEEP = [CACHE_NAME, READING_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests and cross-origin (fonts loaded via CDN will cache naturally)
  if (request.method !== 'GET') return;

  // For navigation requests (HTML pages): network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful page loads
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache, then offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // For static assets: cache-first
  if (request.url.match(/\.(png|jpg|jpeg|webp|svg|woff2?|ttf|css|js)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Daily reading API: stale-while-revalidate (offline support)
  if (request.url.includes('/api/dashboard/daily-reading')) {
    event.respondWith(
      caches.open(READING_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // API calls: always network, never cache
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
