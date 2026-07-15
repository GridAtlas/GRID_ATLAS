const CACHE_NAME = "grid-atlas-static-v69";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./src/styles.css?v=23",
  "./src/main.js?v=64",
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
    const oldStaticCaches = keys.filter((key) => key.startsWith("grid-atlas-static-") && key !== CACHE_NAME);
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();

    if (oldStaticCaches.length > 0) {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => null)));
    }
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
