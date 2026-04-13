const CACHE_NAME = "trakmetric-shell-v6";
const SHELL_PATHS = ["/", "/index.html", "/styles.css", "/app.js", "/analytics.js", "/analyticsEngine.js"];
const SHELL_SET = new Set(SHELL_PATHS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_PATHS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate";
  const isShellAsset = SHELL_SET.has(url.pathname);
  if (!isShellAsset && !isNavigation) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (isShellAsset) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(url.pathname, fresh.clone());
      }
      return fresh;
    } catch (error) {
      if (isNavigation) {
        const cachedIndex = await caches.match("/index.html");
        if (cachedIndex) return cachedIndex;
      }
      if (isShellAsset) {
        const cached = await caches.match(url.pathname);
        if (cached) return cached;
      }
      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })());
});
