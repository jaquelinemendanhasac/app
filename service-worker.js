const CACHE_PREFIX = "studio-sync-pro";
const CACHE_VERSION = "v88-delete-persistence";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./firebase.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(ASSETS); } catch(e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: "no-store" });
      if (res && res.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("./index.html") : null) || new Response("Offline", { status: 503 });
    }
  })());
});
