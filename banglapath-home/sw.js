/* BanglaPath Service Worker for Offline Capability */

const CACHE_VERSION = 'v3';
const CACHE_NAME = `banglapath-${CACHE_VERSION}`;
const STATIC_CACHE = `banglapath-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `banglapath-dynamic-${CACHE_VERSION}`;

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/home.css',
  '/modules.css',
  '/fonts.css',
  '/script.js',
  '/home.js',
  '/modules.js',
  '/config.js',
  '/places.json',
  '/manifest.json',
  '/images/bot-avatar.png',
  '/images/bd-map.png',
  '/fonts/Poppins-400-latin.woff2',
  '/fonts/PlayfairDisplay-700-latin.woff2'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName.startsWith('banglapath-');
            })
            .map((cacheName) => {
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - always prefer the latest app sources, but keep a cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin) {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(
            JSON.stringify({ error: 'Offline - API unavailable' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
      return;
    }

    event.respondWith(fetch(request));
    return;
  }

  // Never let stale app files stick around after a fix is pushed.
  if (request.mode === 'navigate' || /\.(html|css|js|json)$/.test(url.pathname) || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || !networkResponse.ok || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseToCache));
            return networkResponse;
          })
          .catch(() => {
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html');
            }
            return undefined;
          });
      })
  );
});

// Background sync for offline actions (optional enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Push notification support (optional enhancement)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New message from BanglaPath',
    icon: '/images/bot-avatar.png',
    badge: '/images/bot-avatar.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('BanglaPath', options)
  );
});

// Helper function for syncing messages (placeholder)
async function syncMessages() {
  // Implement message syncing logic here
  // console.log('[SW] Syncing messages...');
}
