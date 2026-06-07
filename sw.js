// Sophia PWA — Service Worker
const CACHE_VERSION = 'sophia-v3';
const STATIC_CACHE = CACHE_VERSION;

const PRECACHE_URLS = [
  '/index.html',
  '/js/app.js',
  '/js/search.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/favicon.png',
  // Google Fonts — cache the CSS only (browser fetches font files separately)
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800;900&family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap'
];

// Install: pre-cache critical resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Activate immediately without waiting for page refresh
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: Cache First, network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip browser extension requests
  if (!event.request.url.startsWith(self.location.origin) &&
      !event.request.url.startsWith('https://fonts.googleapis.com') &&
      !event.request.url.startsWith('https://fonts.gstatic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Return cached response if found
      if (cached) return cached;

      // Otherwise fetch from network
      return fetch(event.request).then(response => {
        // Don't cache non-ok responses
        if (!response || response.status !== 200) return response;

        // Clone the response — one to return, one to cache
        const clone = response.clone();
        caches.open(STATIC_CACHE).then(cache => {
          cache.put(event.request, clone);
        });

        return response;
      }).catch(() => {
        // Network failed and no cache — return offline fallback for page navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // For other resources, just fail silently
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
