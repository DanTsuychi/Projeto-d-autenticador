/* ========================================================
   PROJETO D — SERVICE WORKER (sw.js)
   Versão: v28
   Estratégia: Network-First (Rede Primeiro)
   ======================================================== */

const CACHE_NAME = "projeto-d-shell-v28";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.json",
  "./logo.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
