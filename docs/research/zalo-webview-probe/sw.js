// Throwaway service worker for the AND-95 Zalo webview probe.
// It does nothing but exist: registration succeeding or failing is the whole finding.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
