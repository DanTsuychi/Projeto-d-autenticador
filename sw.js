/* ========================================================
   PROJETO D — SERVICE WORKER (sw.js)
   Versão: v26
   Estratégia: Network-First (Rede Primeiro)
   ======================================================== */

const CACHE_NAME = "projeto-d-shell-v26";

// Arquivos base da aplicação para cache offline
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.json",
  "./logo.png"
];

// Instalação e ativação imediata do Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Ativação e limpeza automática de caches antigos no dispositivo
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

// Estratégia REDE PRIMEIRO (Network-First):
// Tenta buscar os arquivos mais atualizados do servidor/GitHub.
// Se estiver sem internet (offline), recorre ao cache salvo.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições que não sejam GET e chamadas externas (ex: API do Supabase, CDNs)
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
