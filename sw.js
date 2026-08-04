// Minimal service worker: makes the app installable on Android (Chrome's
// install criteria want a fetch handler) and keeps the last shell available
// offline. Strategy: network-first for same-origin requests, so an online
// load always gets the newest deployment; the cache is only a fallback.
// Forecast/geocoding requests go to open-meteo.com and are never intercepted.
const CACHE = "wn-shell-v1";
const SHELL = [
  "./",
  "manifest.webmanifest",
  "fonts/inter-latin.woff2",
  "fonts/inter-latin-ext.woff2",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(ev.request, { ignoreSearch: ev.request.mode === "navigate" })
      )
  );
});
