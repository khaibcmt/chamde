/**
 * Service Worker (sw.js) - Edu Chấm Đề 2025
 * Tác giả: Hồ Tấn Khải - Trường THPT Mang Thít, Tỉnh Vĩnh Long
 * Lưu cache toàn bộ tài nguyên tĩnh (HTML, CSS, JS, Icon) để hoạt động Offline 100% trong phòng thi.
 */

const CACHE_NAME = 'edu-cham-de-2025-v2.5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './camera.js',
  './app.js',
  './icon.svg',
  './apple-touch-icon.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png'
];

// 1. Cài đặt Service Worker & Cache toàn bộ file tĩnh
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Một số tài nguyên phụ chưa cache kịp:', err);
      });
    })
  );
});

// 2. Kích hoạt & Dọn dẹp Cache phiên bản cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Chiến lược Stale-While-Revalidate kết hợp Offline Fallback cho phòng thi mất mạng
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Khi mất mạng hoàn toàn trong phòng thi, trả về bản cache hoặc trang chính
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
