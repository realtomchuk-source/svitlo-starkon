const CACHE_NAME = 'sssk-pwa-v1.2.0-g1g2';
const ASSETS = [
  'index.html',
  'style.css',
  'js/pages/home.js',
  'js/pages/home-tablo.js',
  'js/modules/TimelineEngine.js',
  'js/tech-ui.js',
  'assets/logo.png',
  'assets/power_on.png',
  'assets/power_off.png',
  'assets/dashboard_on.svg',
  'assets/dashboard_off.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. Стратегія Network-First для динамічних даних (папка data)
  // Це критично для G1/G2, щоб користувач завжди бачив актуальний графік
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Стратегія Cache-First для статичних ресурсів
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
