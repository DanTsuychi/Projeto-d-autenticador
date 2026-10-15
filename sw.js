const CACHE_NAME = "projeto-d-shell-v13";

// Arquivos base da aplicação
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/logo.png"
];

// Instalação do Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Limpeza automática de caches antigos no dispositivo
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

// Estratégia REDE PRIMEIRO (Network-First)
// Busca sempre o config.js e scripts mais recentes da internet.
// Usa o cache local apenas se o dispositivo estiver totalmente sem internet.
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
