const CACHE_NAME = "grid-atlas-static-v512";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./src/styles.css?v=109",
  "./src/main.js?v=504",
  "./src/barrier.js?v=1",
  "./src/barrier-score.js?v=1",
  "./src/barrier-evaluation.js?v=1",
  "./src/gridatlas-analysis.js?v=2",
  "./src/analysis-layer.js?v=1",
  "./src/drag-hit-testing.js?v=1",
  "./src/shape-analysis.js?v=1",
  "./src/cloud-client.js?v=4",
  "./src/gridatlas-import.js?v=2",
  "./src/gridatlas-assets.js?v=1",
  "./src/fflate.js",
  "./src/fflate.LICENSE.txt",
  "./manifest.webmanifest",
  "./assets/icon-grid.svg",
  "./assets/icon-grid-192.png",
  "./assets/icon-grid-512.png",
  "./assets/apple-touch-icon-grid.png",
  "./assets/og-image.png"
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
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request, event.request.mode === "navigate" ? { cache: "no-store" } : undefined)
      .then((response) => {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return (await caches.match("./")) || Response.error();
        return Response.error();
      })
  );
});
