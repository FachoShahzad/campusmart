/**
 * service-worker.js — Module 14: PWA (network-first)
 * Online: always load the newest files (so updates show immediately).
 * Offline: serve the last saved copy, or the offline page (404.html) for page loads.
 */
const CACHE = "campusmart-v2";
const PRECACHE = ["/404.html", "/manifest.json", "/assets/icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Firebase / CDN requests go straight to the network
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") return caches.match("/404.html");
        return new Response("", { status: 504 });
      })
  );
});
