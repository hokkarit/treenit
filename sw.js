'use strict';

const CACHE = 'hokkarit-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/data/clubs.json',
  '/data/hokkarit/teams.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(resp => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    e.waitUntil(
      self.registration.showNotification('Hokkarit Kotitreenit 🏒', {
        body: 'Muista tarkistaa päivän harjoitustehtävät!',
        icon: 'https://static.jopox.fi/hokkarit/logos/logo-300.png',
        badge: 'https://static.jopox.fi/hokkarit/logos/logo-300.png',
        tag: 'daily-reminder',
        requireInteraction: false
      })
    );
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
