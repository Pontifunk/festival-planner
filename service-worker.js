/* Festival Planner Service Worker (minimal, low-traffic) */

const CACHE_NAME = "festival-planner-v1";

// App-Shell: wird cache-first ausgeliefert
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/legal/privacy.html",
  "/legal/imprint.html",
  // optional: i18n defaults (werden sonst beim ersten Load gecached)
  "/i18n/de.json",
  "/i18n/en.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests (no caching of Spotify/YouTube/Apple links)
  if (url.origin !== self.location.origin) return;

  // Lineup + i18n JSON: network-first (fresh if possible), fallback cache
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // HTML pages: network-first to avoid stale shell after deploy, fallback cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/index.html")))
    );
    return;
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
