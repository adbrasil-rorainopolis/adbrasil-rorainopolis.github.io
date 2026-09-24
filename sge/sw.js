const CACHE = 'sge-pwa-v107';
const SHELL = ['./', './index.html', './gestao.js',
  './financas.js', './espiritual.js', './comunidade.js', './membro.js', './missoes.js', './manifest.webmanifest', './sge-logo.css', './icons/logo.png', './icons/icon-192.png', './icons/icon-512.png', './icons/logo_ad_brasil.png', './icons/logo_sge.png', './icons/cabecalho_ad_brasil.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o HTTP cache do Pages — o precache sempre baixa a versao publicada
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
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
    // no-cache: sempre revalida com o servidor (etag) — evita servir arquivo velho
    // do HTTP cache do GitHub Pages logo apos um deploy
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// --- Push: notificação chega mesmo com o app fechado ---
self.addEventListener('push', (e) => {
  let dados = { titulo: 'SGE AD Brasil', corpo: 'Nova notificação.', url: './' };
  try { dados = { ...dados, ...(e.data ? e.data.json() : {}) }; } catch (erro) { /* payload inválido */ }
  e.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'sge-notificacao',
      data: { url: dados.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberta = lista.find((c) => c.url.includes('sge'));
      if (aberta) return aberta.focus();
      return self.clients.openWindow(destino);
    })
  );
});
