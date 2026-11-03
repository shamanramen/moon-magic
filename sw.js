// Stale-while-revalidate: instant + offline from cache, refreshed from the network in the background.
const CACHE = 'mm-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || request.url.includes('geocoding-api.open-meteo.com')) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(request, { ignoreSearch: true });
    const net = fetch(request).then(r => { if (r.ok || r.type === 'opaque') cache.put(request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
