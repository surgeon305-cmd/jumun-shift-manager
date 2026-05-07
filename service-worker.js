const CACHE = 'jumun-shift-v4';
const STATIC_ASSETS = [
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      const oldKeys = keys.filter(k => k !== CACHE);
      return Promise.all(oldKeys.map(k => caches.delete(k)))
        .then(() => self.clients.claim())
        .then(() => {
          // 구버전 캐시 존재 시(= 실제 업데이트) 열린 창에 리로드 신호
          if (oldKeys.length > 0) {
            return self.clients.matchAll({ type: 'window' })
              .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })));
          }
        });
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 외부 API (Supabase, 날씨): 네트워크 우선
  if (url.hostname.includes('supabase') || url.hostname.includes('open-meteo') || url.hostname.includes('windy')
      || url.hostname.includes('jsdelivr') || url.hostname.includes('unpkg')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // HTML 앱 셸: 항상 네트워크 우선 → 배포 즉시 반영, 오프라인 fallback
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 정적 에셋 (아이콘, manifest): 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }))
  );
});
