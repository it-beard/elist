/* Service worker: сайт і база працуюць афлайн. Ніякай аналітыкі, ніякіх зьнешніх запытаў. */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`, DATA = `data-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isData = (url) => url.pathname.startsWith(`${BASE}data/`) || url.pathname === `${BASE}feed.xml`;
const isAsset = (url) => url.pathname.startsWith(`${BASE}assets/`);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Старонка: сетка → кэш (каб пасьля дэплою браць сьвежую абалонку, а афлайн — захаваную).
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(BASE, copy)); return r; })
      .catch(() => caches.match(BASE)));
    return;
  }
  // Хэшаваныя асэты — нязьменныя: кэш → сетка.
  if (isAsset(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return r; })));
    return;
  }
  // База: сетка → кэш; фрагменты нязьменныя, пакуль не зьменіцца індэкс, але для прастаты — тая ж стратэгія.
  if (isData(url)) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(DATA).then((c) => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req)));
  }
});
