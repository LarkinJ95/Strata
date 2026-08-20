/*
 * STRATA field service worker.
 *
 * Deliberately conservative. Its job is to keep an already-visited Field Mode
 * page reachable in a basement, not to serve stale compliance data:
 *   - GET only, same-origin only.
 *   - Never touches /api/ (mutations own their retry via the field queue).
 *   - Never caches a URL carrying an ?access= session token.
 *   - Hashed build assets are immutable, so they are cache-first.
 *   - Pages are network-first, falling back to the last good copy, then to a
 *     static offline notice.
 */
const VERSION = "strata-field-v1";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function cacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  // A cached response keyed by a session token would leak across sessions and
  // go stale the moment the token rotates.
  if (url.searchParams.has("access")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!cacheable(request)) return;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match(OFFLINE_URL))
            .then((hit) => hit || Response.error())
        )
    );
  }
});
