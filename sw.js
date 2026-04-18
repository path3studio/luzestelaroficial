/**
 * Luz Estelar Oficial — Service Worker
 * Enables offline access and installable PWA experience.
 * Strategy: Network-first with cache fallback for pages,
 * Cache-first for static assets (fonts, images, CSS).
 */

// Bumped v19 → v20 (Apr 18 phase 5): "alma nativa" polish —
// new toast / sw-update / haptic modules, skeleton loading CSS,
// and the SW itself now accepts SKIP_WAITING so the sw-update
// toast can hand the user to the new version instantly.
const CACHE_NAME = 'luzestelar-v20';
const OFFLINE_URL = '/offline.html';
const READING_CACHE = 'luzestelar-reading-v1';

// Static assets to precache on install.
// Includes the design-system files so they're offline-ready on day one.
const PRECACHE_URLS = [
  '/',
  '/mi-dia.html',
  '/en/my-day.html',
  '/dashboard.html',
  '/compatibilidad-personal.html',
  '/ajustes.html',
  '/mapa-estelar.html',
  '/en/mapa-estelar.html',
  '/css/design-tokens.css',
  '/css/stars.css',
  '/css/pwa.css',
  '/css/icons.css',
  '/css/components.css',
  '/js/icons.js',
  '/js/stars.js',
  '/js/sheet-modal.js',
  '/js/toast.js',
  '/js/sw-update.js',
  '/js/haptic.js',
  '/js/bottom-tabs.js',
  '/js/upgrade-sheet.js',
  '/js/install-prompt.js',
  '/js/hero-install.js',
  '/app_icon.png',
  '/manifest.json',
  OFFLINE_URL,
];

// Accept SKIP_WAITING messages from the client (sw-update.js toast).
// When the user taps "Actualizar" on the new-version banner, the
// page posts { type: 'SKIP_WAITING' }. We hand over control
// immediately instead of waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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

  // For static assets: split strategy —
  //   - CSS/JS → stale-while-revalidate (instant from cache, but
  //     quietly fetched in background so next visit has fresh bits).
  //     This is what lets new design-system rollouts land on users'
  //     PWA without them having to uninstall/reinstall.
  //   - Images/fonts → cache-first (they rarely change, so we save
  //     the round-trip).
  if (request.url.match(/\.(css|js)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fresh = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached); // offline → serve cache
          return cached || fresh;
        })
      )
    );
    return;
  }
  if (request.url.match(/\.(png|jpg|jpeg|webp|svg|woff2?|ttf|ico)$/)) {
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

// ─── Web Push ──────────────────────────────────────────────────────────
// Payload contract (from the daily-cron Worker):
//   { title, body, url, icon, badge, tag, lang }
// Any missing field falls back to a branded default.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }

  const lang = (data.lang === 'en') ? 'en' : 'es';
  const title = data.title || (lang === 'en'
    ? '\u2728 Your daily reading'
    : '\u2728 Tu lectura de hoy');
  const body = data.body || (lang === 'en'
    ? 'Open Luz Estelar to see today\u2019s sky.'
    : 'Abre Luz Estelar para ver tu cielo de hoy.');
  const url = data.url || (lang === 'en' ? '/en/my-day.html' : '/mi-dia.html');

  const options = {
    body,
    icon: data.icon || '/app_icon.png',
    badge: data.badge || '/app_icon.png',
    tag: data.tag || 'luzestelar-daily',
    renotify: false,
    data: { url },
    vibrate: [60, 40, 60],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When a notification is clicked, focus any open tab on the target URL or
// open a fresh one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const c of clientsList) {
      try {
        const cUrl = new URL(c.url);
        if (cUrl.pathname === targetUrl || cUrl.pathname + cUrl.search === targetUrl) {
          await c.focus();
          return;
        }
      } catch { /* ignore malformed client URL */ }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

// If the browser re-subscribes (e.g. the push endpoint was rotated),
// forward the new subscription to our backend without bothering the user.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const reg = await self.registration;
      if (!reg || !reg.pushManager) return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* best-effort, silent */ }
  })());
});
