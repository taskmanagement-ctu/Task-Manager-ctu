const CACHE_NAME = 'ctu-taskdesk-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.png',
  '/apple-touch-icon.png'
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
  // Only handle HTTP/HTTPS schemes
  if (!event.request.url.startsWith('http')) return;

  // Only handle GET requests; never intercept POST, PUT, DELETE, etc.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first for API endpoints
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, message: 'You are currently offline.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        });
      })
    );
    return;
  }

  // Network-first with offline fallback for HTML navigation requests (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Cache-first with network fallback for images and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/assets/') || 
           url.pathname.endsWith('.png') || 
           url.pathname.endsWith('.svg') || 
           url.pathname.endsWith('.css') || 
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.woff2'))
        ) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          }).catch(() => {});
        }
        return networkResponse;
      });
    }).catch(async () => {
      // Graceful fallback if network request fails (e.g. navigation aborted or network dropped)
      if (event.request.mode === 'navigate') {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
      }
      return new Response('', { status: 408, statusText: 'Request Failed' });
    })
  );
});
