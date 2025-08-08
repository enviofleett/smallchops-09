// Minimal, production-safe Service Worker
const CACHE_NAME = 'starters-v5';
const PRECACHE_URLS = ['/manifest.json'];

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

// Fetch: smarter routing to avoid stale HTML and broken chunks
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isCrossOrigin = url.origin !== self.location.origin;
  const isSupabase = url.origin.endsWith('.supabase.co');
  const isPaystack = url.hostname.endsWith('paystack.co') || url.hostname.endsWith('checkout.paystack.com');

  // Never intercept: non-GET, preflight, cross-origin, Supabase, Paystack, or the SW file itself
  if (req.method !== 'GET' || isCrossOrigin || isSupabase || isPaystack || url.pathname === '/sw.js') {
    return; // Let the browser handle it
  }

  // Navigation requests: Network-first, fallback to cached shell
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) {
            // Cache latest app shell for offline fallback
            cache.put('/', resp.clone());
          }
          return resp;
        } catch (err) {
          const cachedShell = await cache.match('/');
          return (
            cachedShell || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          );
        }
      })()
    );
    return;
  }

  // Versioned static assets: cache-first with background revalidation
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => undefined);
        return cached || (await networkPromise) || new Response('Offline asset', { status: 503 });
      })()
    );
    return;
  }

  // Default strategy: try network, then cache
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const resp = await fetch(req);
        if (resp && resp.ok && resp.type === 'basic') {
          cache.put(req, resp.clone());
        }
        return resp;
      } catch (err) {
        const cached = await cache.match(req);
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});
