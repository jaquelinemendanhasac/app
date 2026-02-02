// service-worker.js (SJM FIX - GitHub Pages friendly)
const CACHE_PREFIX = "sjm-gestao";
const CACHE_VERSION = "v9"; // <-- MUDE AQUI a cada deploy (v9, v10...)
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

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

    // Força baixar do servidor (evita pegar arquivo velho do HTTP cache)
    await cache.addAll(
      ASSETS.map((u) => new Request(u, { cache: "reload" }))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Remove qualquer cache antigo do app (mesmo se nome mudou)
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
    pathname.endsWith("/") ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith("/styles.css") ||
    pathname.endsWith("/app.js") ||
    pathname.endsWith("/firebase.js") ||
    pathname.endsWith("/manifest.json") ||
    pathname.includes("/icons/")
  );
}

// Stale-While-Revalidate (rápido + atualiza em background)
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    // Só cacheia se veio OK
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  // Se tem cache, devolve cache na hora e atualiza em background
  if (cached) {
    eventWaitUntilSafe(fetchPromise);
    return cached;
  }

  // Se não tem cache, tenta rede
  const fresh = await fetchPromise;
  return fresh || new Response("Offline", { status: 503 });
}

// Cache-first com atualização em background (bom pro index.html)
async function cacheFirstWithUpdate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (cached) {
    eventWaitUntilSafe(fetchPromise);
    return cached;
  }

  const fresh = await fetchPromise;
  return fresh || new Response("Offline", { status: 503 });
}

// Helper: evita erro se usado fora do handler
function eventWaitUntilSafe(promise) {
  try { self.__lastEvent?.waitUntil?.(promise); } catch {}
}

self.addEventListener("fetch", (event) => {
  self.__lastEvent = event;

  const req = event.request;

  // Só GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Não cachear outros domínios (Firebase CDN etc)
  if (!isSameOrigin(url)) return;

  // Navegação (quando abre /app/ ou recarrega página) -> sempre index.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      // tenta rede pra pegar HTML novo, mas se falhar, cai no cache
      return cacheFirstWithUpdate("./index.html");
    })());
    return;
  }

  // Ícones e assets do app
  if (isAssetPath(url.pathname)) {
    // index.html: cache-first + update
    if (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
      event.respondWith(cacheFirstWithUpdate(req));
      return;
    }

    // css/js/manifest/icons: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Demais: rede normal, sem cache forçado
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
