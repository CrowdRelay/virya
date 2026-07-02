const CACHE_NAME = 'virya-v6'
const STATIC_CACHE = 'virya-static-v6'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ['/', '/pl/', '/videos/', '/pl/videos/', '/gallery/', '/pl/gallery/'].map(
          (u) => cache.add(u).catch(() => {})
        )
      )
    )
  )
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

  // Cache YouTube thumbnails cache-first
  if (url.hostname === 'i.ytimg.com') {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached
          return fetch(new Request(event.request.url, { mode: 'no-cors', credentials: 'omit' }))
            .then((res) => {
              cache.put(event.request, res.clone())
              return res
            })
        })
      })
    )
    return
  }

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

  // Network-first for HTML: always fetch fresh, fall back to cache when offline
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Network-first fallback for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
