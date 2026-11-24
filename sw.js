/* 가족 미니게임 - 서비스 워커 (전부 오프라인에서 동작) */
const SHELL = 'fg-shell-v9';
const FILES = [
  './', './index.html', './style.css?v=9', './app.js?v=9',
  './peerjs.min.js?v=9', './manifest.webmanifest?v=9', './icon-192.png', './icon-512.png', './icon-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(
      // 이 앱이 쓰던 옛 캐시(단어사냥의 AI 모델 포함)만 정리한다
      ks.filter(k => (k.indexOf('fg-') === 0 || k.indexOf('wh-') === 0) && k !== SHELL)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(new Request(req.url, { cache: 'no-store' }))
      .then(res => {
        if (res && res.ok) caches.open(SHELL).then(c => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
