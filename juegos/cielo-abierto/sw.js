// Service worker de Cielo Abierto: guarda el juego para poder jugar sin conexión.
// Con conexión siempre se pide la versión nueva (y se guarda); sin conexión se usa la guardada.
// Al publicar cambios grandes, sube VERSION para limpiar lo guardado antes.
const VERSION = 'cielo-abierto-v1';
const ARCHIVOS = [
  './jugar.html', './index.html', './juego.css', './manifest.webmanifest', './portada.svg',
  './vendor/three.min.js',
  './js/destinos.js', './js/mapa-tierra.js', './js/mapa.js', './js/terreno.js', './js/fisica.js', './js/mundo.js',
  './js/instrumentos.js', './js/pasajeros.js', './js/aerolinea.js', './js/misiones.js', './js/instalar.js', './js/juego.js',
  './iconos/icono.svg', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-adaptable-512.png', './iconos/apple-touch-icon.png',
  '../../assets/icono.svg', '../../css/estilos.css',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('cielo-abierto-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const peticion = ev.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;
  // La librería 3D casi nunca cambia: primero la guardada. Lo demás: primero la red.
  if (peticion.url.includes('/vendor/')) {
    ev.respondWith(caches.match(peticion).then((r) => r || fetch(peticion)));
    return;
  }
  ev.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) { const copia = respuesta.clone(); caches.open(VERSION).then((c) => c.put(peticion, copia)); }
        return respuesta;
      })
      .catch(() => caches.match(peticion, { ignoreSearch: true }).then((r) => r || (peticion.mode === 'navigate' ? caches.match('./jugar.html') : undefined)))
  );
});
