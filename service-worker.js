// Cache versioning to bust old assets when app changes.
const BUILD_ID = "2026-02-07-2";
const CACHE_NAME = `app-shell-${BUILD_ID || "v1"}`;
// Assets are served from the site root.
const withBase = (path) => path;

// Core shell assets that should be available offline.
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/dist/styles.min.css",
  "/dist/app.bundle.min.js",
  "/app.data.js",
  "/app.ui.js",
  "/app.group.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/legal/privacy.html",
  "/legal/imprint.html",
  "/tomorrowland/2026/w1/group/",
  "/tomorrowland/2026/w2/group/",
  "/i18n/de.json",
  "/i18n/en.json",
];

// Install: cache the core shell and activate immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
      self.skipWaiting()
    ])
  );
});

// Activate: clean up old caches and take control of open clients.
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

// Allow the page to trigger skipWaiting for updates.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING" || event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Detect HTML navigations (app shell).
function isHtmlRequest(req) {
  if (req.mode === "navigate") return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

// Detect JSON data requests (lineup snapshots, i18n).
function isDataJsonRequest(url) {
  return url.pathname.startsWith("/data/") && url.pathname.endsWith(".json");
}

// Detect static assets for cache-first shell.
function isAppShellRequest(url) {
  return CORE_ASSETS.includes(url.pathname) || CORE_ASSETS.includes(url.pathname + "/");
}

// Detect static assets for stale-while-revalidate.
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

// Cache a successful response for later offline use.
async function cacheResponse(cache, request, response) {
  if (!response || !response.ok) return;
  await cache.put(request, response);
}

// Cache-first strategy with network fallback.
async function cacheFirst(request, fallbackToIndex = false) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    await cacheResponse(cache, request, response.clone());
    return response;
  } catch {
    if (fallbackToIndex) {
      const shell = await cache.match("/index.html");
      if (shell) return shell;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

// Stale-while-revalidate for data and static assets.
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
  return cached || network || new Response("", { status: 504, statusText: "Offline" });
}

// Network-first for fresh JSON data with cache fallback.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    await cacheResponse(cache, request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response("", { status: 504, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isHtmlRequest(request)) {
    event.respondWith((async () => {
      const response = await staleWhileRevalidate(request);
      if (response && response.status !== 504) return response;
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match("/index.html");
      return shell || response;
    })());
    return;
  }

  if (isDataJsonRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAppShellRequest(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
