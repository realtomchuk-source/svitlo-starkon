const CACHE_NAME = 'sssk-cache-v1.5.4';
const ASSETS = [
  'index.html?v=1.5.1',
  'style.css?v=1.5.1',
  'js/pages/home.js?v=1.5.1',
  'js/pages/home-tablo.js?v=1.5.1',
  'js/modules/TimelineEngine.js?v=1.5.1',
  'js/tech-ui.js?v=1.5.1',
  'assets/power_off.png'
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
