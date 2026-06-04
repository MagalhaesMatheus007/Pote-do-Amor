const VERSION       = 'v7';
const CACHE_STATIC  = `pote-amor-static-${VERSION}`;
const CACHE_DYNAMIC = `pote-amor-dynamic-${VERSION}`;

// Arquivos que nunca mudam — pré-carregados na instalação
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './data.json',
  './manifest.json',
  './offline.html',
  './icon-192-v2.png',
  './icon-512-v2.png'
];

/* ── INSTALL ───────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache =>
        Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE — limpa caches antigos ──────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ─────────────────────────────────── */
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignora extensões do navegador e protocolos que não podem ser cacheados
  if (!['http:', 'https:'].includes(url.protocol)) {
    return;
  }

  // Evita erro com vídeo/áudio em respostas parciais
  if (request.headers.has('range')) {
    e.respondWith(fetch(request));
    return;
  }

  // Google Fonts — Stale While Revalidate (rápido + sempre atualizado)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // data.json — Network First (o conteúdo pode ser atualizado pelo dev)
  if (url.pathname.endsWith('data.json')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Fotos, vídeo, música — Cache First dinâmico (grandes, raramente mudam)
  if (/\.(jpg|jpeg|png|gif|webp|mp4|mp3|ogg)$/i.test(url.pathname)) {
    e.respondWith(cacheFirstDynamic(request));
    return;
  }

  // Tudo mais (HTML, CSS, JS) — Cache First estático
  e.respondWith(cacheFirst(request));
});

/* ── ESTRATÉGIAS ───────────────────────────── */

// Cache First — retorna do cache; busca na rede só se não tiver
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match('./offline.html'))
      ?? new Response('Offline', { status: 503 });
  }
}

// Cache First dinâmico — igual ao anterior, mas usa CACHE_DYNAMIC
async function cacheFirstDynamic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response.ok && response.status !== 206) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// Network First — tenta rede; cai no cache se offline
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('{}', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate — responde do cache imediatamente e atualiza em segundo plano
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await fetchPromise)
    ?? new Response('', { status: 503 });
}

/* ── MENSAGENS DO CLIENTE ──────────────────── */
// Recebe "SKIP_WAITING" quando o usuário aceita atualizar o app
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
