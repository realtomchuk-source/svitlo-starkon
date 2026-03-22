const CACHE_NAME = 'sssk-pwa-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'js/pages/home.js',
  'assets/logo.png',
  'assets/power_on.png',
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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
