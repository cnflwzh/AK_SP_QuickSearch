/* global self, caches */
// The old application registered this exact script URL at scope /. A replacement
// with no fetch handler lets navigations use the browser's native HTTP redirects.
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith('wsq-'))
            .map((name) => caches.delete(name)),
        );
      } finally {
        // Removing a registration and its offline assets preserves the origin's localStorage.
        await self.registration.unregister();
      }
    })(),
  );
});
