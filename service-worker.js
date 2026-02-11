// service-worker.js (SJM FIX - GitHub Pages friendly / HARD REFRESH)
const CACHE_PREFIX = "sjm-gestao";
const CACHE_VERSION = "v14"; // <-- MUDE AQUI a cada deploy (v11, v12...)
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// ✅ Cache-bust para forçar baixar arquivo novo do servidor
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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // ✅ Força baixar do servidor (e não do cache HTTP)
    await cache.addAll(
      ASSETS.map((u) => new Request(`${u}?v=${CACHE_VERSION}`, { cache: "no-store" }))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // ✅ Remove caches antigos
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME) ? caches.delete(k) : null)
    );

    await self.clients.claim();
  })());
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAssetPath(pathname) {
  return (
    pathname === "/" ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/styles.css") ||
    pathname.endsWith("/app.js") ||
    pathname.endsWith("/firebase.js") ||
    pathname.endsWith("/manifest.json") ||
    pathname.includes("/icons/")
  );
}

// ✅ Stale-While-Revalidate
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req, { cache: "no-store" })
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    eventWaitUntilSafe(fetchPromise);
    return cached;
  }

  const fresh = await fetchPromise;
  return fresh || new Response("Offline", { status: 503 });
}

// ✅ Network-first para HTML (pega sempre o mais novo; cai no cache se offline)
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
}

// Helper
function eventWaitUntilSafe(promise) {
  try { self.__lastEvent?.waitUntil?.(promise); } catch {}
}

// ✅ Função faltando (para não quebrar no navigate)
async function cacheFirstWithUpdate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req, { cache: "no-store" })
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    eventWaitUntilSafe(fetchPromise);
    return cached;
  }

  const fresh = await fetchPromise;
  return fresh || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  self.__lastEvent = event;

  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!isSameOrigin(url)) return;

  // ✅ IMPORTANTE: HTML sempre mais novo (resolve o “sumiu Calendário” após deploy)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      // pega SEMPRE o mais novo; se offline cai no cache
      return networkFirst(new Request("./index.html?v=" + CACHE_VERSION, { cache: "no-store" }));
    })());
    return;
  }

  // ✅ Assets do app
  if (isAssetPath(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Demais
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

