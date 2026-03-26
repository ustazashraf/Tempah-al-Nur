const cacheName = 'surau-v11';
const staticAssets = [
  './',
  './index.html',
  './manifest.json',
  './icons/app-icon-32.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
];

// Peringkat pemasangan: simpan aset dalam cache
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Cache aset penting secara berasingan supaya satu fail gagal tidak gagalkan install SW.
    await Promise.all(staticAssets.map(async asset => {
      try {
        await cache.add(asset);
      } catch (err) {
        console.warn('[SW] Gagal cache aset:', asset, err);
      }
    }));
    await self.skipWaiting();
  })());
});

// Peringkat pengaktifan
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Peringkat fetch: ambil data dari cache jika tiada internet
self.addEventListener('fetch', async e => {
  const req = e.request;
  const url = new URL(req.url);

  // Jangan cache request selain GET (contoh POST tempahan)
  if (req.method !== 'GET') {
    e.respondWith(fetch(req));
    return;
  }

  // Untuk page/navigation, utamakan network supaya index.html sentiasa terkini
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req));
    return;
  }

  if (url.origin === location.origin) {
    // Elak icon/manifest lama tersekat dalam cache semasa install PWA
    if (url.pathname.endsWith('/manifest.json') || url.pathname.includes('/icons/')) {
      e.respondWith(networkFirst(req));
      return;
    }
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkAndCache(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  return cached || fetch(req);
}

async function networkAndCache(req) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    await cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || fetch(req);
  }
}

async function networkFirst(req) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    await cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || fetch(req);
  }
}
