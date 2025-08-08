// Minimal, production-safe Service Worker
const CACHE_NAME = 'starters-v4';
const PRECACHE_URLS = ['/', '/manifest.json'];

// Install: precache critical shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : Promise.resolve()))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: bypass cross-origin/API, cache-first for same-origin GET only
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isCrossOrigin = url.origin !== self.location.origin;
  const isSupabase = url.origin.endsWith('.supabase.co');
  const isPaystack = url.hostname.endsWith('paystack.co') || url.hostname.endsWith('checkout.paystack.com');

  // Never intercept: non-GET, preflight, cross-origin, Supabase, Paystack
  if (req.method !== 'GET' || isCrossOrigin || isSupabase || isPaystack) {
    return; // Let the browser handle it (avoids CORS/preflight interference)
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        if (resp && resp.ok && resp.type === 'basic') {
          cache.put(req, resp.clone());
        }
        return resp;
      } catch (err) {
        // Optional fallback: return cache if available or a simple offline response
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});
