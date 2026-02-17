// Cache versioning to bust old assets when app changes.
const BUILD_ID = "2026-02-17-3";
const CACHE_NAME = `app-shell-${BUILD_ID || "v1"}`;
const OFFLINE_RESPONSE = new Response("Offline", { status: 503, statusText: "Offline" });

const CORE_ASSETS = [
  "/",
  "/404.html",
  "/index.html",
  "/dist/styles.min.css",
  "/dist/app.bundle.min.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/i18n/de.json",
  "/i18n/en.json",
  "/tomorrowland/2026/w1/",
  "/tomorrowland/2026/w2/",
  "/tomorrowland/2026/w1/artists/",
  "/tomorrowland/2026/w2/artists/",
  "/tomorrowland/2026/w1/group/",
  "/tomorrowland/2026/w2/group/",
  "/legal/privacy.html",
  "/legal/imprint.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
      self.skipWaiting()
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING" || event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHtmlRequest(req) {
  if (req.mode === "navigate") return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isDataJsonRequest(url) {
  return url.pathname.startsWith("/data/") && url.pathname.endsWith(".json");
}

function isStaticAssetRequest(req, url) {
  const dest = req.destination;
  if (dest === "style" || dest === "script" || dest === "image" || dest === "font") return true;
  return (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg")
  );
}

async function cacheResponse(cache, request, response) {
  if (!response || !response.ok) return;
  await cache.put(request, response);
}

async function networkFirst(request, fallback = null) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    await cacheResponse(cache, request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const fallbackResponse = await cache.match(fallback);
      if (fallbackResponse) return fallbackResponse;
    }
    return OFFLINE_RESPONSE;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      await cacheResponse(cache, request, response.clone());
      return response;
    })
    .catch(() => null);
  const network = await fetchPromise;
  return cached || network || OFFLINE_RESPONSE;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  if (isDataJsonRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
