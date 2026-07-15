const CACHE_NAME = "grid-atlas-static-v80";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./src/styles.css?v=24",
  "./src/main.js?v=73",
  "./manifest.webmanifest",
  "./assets/icon-retro.svg",
  "./assets/icon-retro-192.png",
  "./assets/icon-retro-512.png",
  "./assets/apple-touch-icon-retro.png"
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    // The page handles update reloads to avoid freezing iOS PWA touch input.
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./")))
  );
});
