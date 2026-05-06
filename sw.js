const CACHE_NAME = 'pedidos-v5.1';

// Archivos propios (mismo origen) — se cachean con petición normal
const SAME_ORIGIN_ASSETS = [
    './solicitud_pedidos_v5.html',
    './manifest.json',
];

// Recursos externos de CDN — se cachean con no-cors (respuesta opaca aceptable)
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            const sameOrigin = cache.addAll(SAME_ORIGIN_ASSETS);
            const cdn = cache.addAll(CDN_ASSETS.map(url => new Request(url, { mode: 'no-cors' })))
                .catch(() => {}); // CDN puede fallar sin romper la instalación
            return Promise.all([sameOrigin, cdn]);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Google APIs siempre van por red (nunca cachear tokens ni datos en vivo)
    if (url.includes('script.google.com') || url.includes('docs.google.com') || url.includes('spreadsheets')) {
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 503 }))
        );
        return;
    }

    // Cache-first para todo lo demás
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && (response.status === 200 || response.type === 'opaque')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached || new Response('Sin conexión', { status: 503 }));
        })
    );
});
