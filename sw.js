// modern-tennis-accounting SW - network first (no HTML caching)
const CACHE_NAME = 'modern-tennis-accounting-v20260122_055702';
const ASSETS = [
  './manifest.json',
  './modern-192.png',
  './modern-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
    ])
  );
});

// ✅ HTML/JS는 항상 네트워크 우선 (옛날 index.html 캐시 문제 방지)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 같은 origin만 처리
  if (url.origin !== self.location.origin) return;

  // index.html 및 문서는 절대 캐시 우선으로 주지 않음
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('./index.html')));
    return;
  }

  // 나머지 정적자원은 캐시 있으면 쓰고 없으면 네트워크
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
