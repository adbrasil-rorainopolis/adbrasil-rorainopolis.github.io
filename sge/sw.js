const CACHE = 'sge-pwa-v11';
const SHELL = ['./', './index.html', './manifest.webmanifest', './sge-logo.css', './icons/logo.png', './icons/icon-192.png', './icons/icon-512.png', './icons/logo_ad_brasil.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API sempre vai pra rede — nunca cachear dados nem autenticação
  if (url.hostname.endsWith('supabase.co')) return;
  // Shell: network-first com fallback pro cache (funciona offline o "esqueleto")
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
