const CACHE_NAME = 'virya-v2'
const STATIC_CACHE = 'virya-static-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Cache static assets with cache-first
  if (url.pathname.match(/\.(webp|png|jpg|jpeg|svg|css|js|woff2?|ttf|otf)$/)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response
          }
          return fetch(event.request).then((fetchResponse) => {
            cache.put(event.request, fetchResponse.clone())
            return fetchResponse
          })
        })
      })
    )
    return
  }

  // Skip API routes — always network
  if (url.pathname.startsWith('/api/')) return

  // Stale-while-revalidate for HTML: serve cache instantly, refresh in background
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone())
            return response
          })
          return cached || fetchPromise
        })
      })
    )
    return
  }

  // Network-first fallback for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
