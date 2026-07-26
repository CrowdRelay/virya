const CACHE_NAME = 'virya-v8'
const STATIC_CACHE = 'virya-static-v8'
const STATIC_ASSET_PATTERN = /\.(webp|png|jpg|jpeg|svg|css|js|woff2?|ttf|otf)$/
const PRIVATE_HTML_PATTERN = /^\/(?:pl\/)?(?:merch\/(?:success|cancel)|area\/claim)(?:\/|$)/

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
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept writes, APIs, or cross-origin requests.
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Cache same-origin static assets with cache-first.
  if (STATIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response
          }
          return fetch(event.request).then((fetchResponse) => {
            if (fetchResponse.ok) {
              event.waitUntil(cache.put(event.request, fetchResponse.clone()))
            }
            return fetchResponse
          })
        })
      })
    )
    return
  }

  // Network-first for HTML: always fetch fresh, fall back to cache when offline
  if (event.request.headers.get('accept')?.includes('text/html')) {
    const canCache =
      !url.search && !PRIVATE_HTML_PATTERN.test(url.pathname)

    if (!canCache) {
      event.respondWith(fetch(event.request))
      return
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            )
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
