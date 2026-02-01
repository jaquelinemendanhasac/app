const CACHE_NAME = "sjm-gestao-v7";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return (
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/firebase.js") ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("/") ||
    url.pathname === "/" ||
    url.pathname.includes("/icons/")
  );
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // não cachear outros domínios
  if (url.origin !== self.location.origin) return;

  // Ícones: cache-first
  if (url.pathname.includes("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // App shell (html/css/js/manifest): network-first
  if (isStaticAsset(url)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Demais: network-first também
  event.respondWith(networkFirst(req));
});
