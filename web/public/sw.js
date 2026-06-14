const VERSION = "v1";
const SHELL_CACHE = `fmc-shell-${VERSION}`;
const ASSET_CACHE = `fmc-assets-${VERSION}`;
const TILE_CACHE = `fmc-tiles-${VERSION}`;
const TILE_LIMIT = 500;

const SHELL_URLS = ["/", "/create", "/join", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (const key of keys.slice(0, keys.length - limit)) {
    await cache.delete(key);
  }
}

function isTile(url) {
  return url.hostname.endsWith("tile.openstreetmap.org");
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match("/");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      trimCache(TILE_CACHE, TILE_LIMIT);
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isTile(url)) {
    event.respondWith(cacheFirstTile(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});
