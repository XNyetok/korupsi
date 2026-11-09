/**
 * Kill switch. The game no longer uses a service worker, but browsers that
 * installed the old one keep running it until a new script arrives at this
 * same URL. This one deletes every cache, unregisters itself and reloads the
 * open tabs, so they come back straight from the network.
 *
 * Keep serving it, uncached, until the old worker is gone from the wild
 * (a few months), then delete it and its nginx location.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        windows.map((client) => Promise.resolve(client.navigate(client.url)).catch(() => {})),
      );
    })(),
  );
});

// No fetch handler on purpose: every request goes to the network.
