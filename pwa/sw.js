const CACHE_NAME = 'sssk-pwa-v1.1.0';
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
