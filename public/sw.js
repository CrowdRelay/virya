const CACHE_NAME = 'virya-v15'
const STATIC_CACHE = 'virya-static-v15'
const STATIC_ASSET_PATTERN = /\.(webp|png|jpg|jpeg|svg|css|js|woff2?|ttf|otf)$/
const MAX_PAGE_CACHE_ENTRIES = 32
const MAX_STATIC_CACHE_ENTRIES = 160

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
}
const PRIVATE_HTML_PATTERN = /^\/(?:pl\/)?(?:merch\/(?:success|cancel)|area\/claim|staff|tickets(?:\/|$)|win(?:\/|$))/
const OFFLINE_HTML = `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Virya offline</title><body style="margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui;padding:32px"><main style="max-width:680px;margin:12vh auto"><p style="color:#fbbf24;font-weight:900;letter-spacing:.16em">VIRYA / OFFLINE</p><h1>Nie udało się połączyć</h1><p style="color:#d4d4d8;line-height:1.6">Sprawdź internet i odśwież stronę. Prywatne bilety i panel staff nigdy nie są odtwarzane z cache.</p><button onclick="location.reload()" style="min-height:44px;border:0;background:#fbbf24;padding:0 16px;font-weight:900">SPRÓBUJ PONOWNIE</button></main></body></html>`

const offlineHtmlResponse = () =>
  new Response(OFFLINE_HTML, {
    status: 503,
    statusText: 'Offline',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Virya-Offline': '1',
    },
  })

const offlineAssetResponse = () =>
  new Response('', {
    status: 503,
    statusText: 'Offline',
    headers: {
      'Cache-Control': 'no-store',
      'X-Virya-Offline': '1',
    },
  })

async function notifyOffline(pathname) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  await Promise.all(
    clients.map((client) =>
      client.postMessage({ type: 'VIRYA_OFFLINE_FALLBACK', path: pathname.slice(0, 300) })
    )
  )
}

async function cacheMatchOr(request, fallback) {
  const cached = await caches.match(request)
  return cached || fallback()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ['/', '/pl/', '/videos/', '/pl/videos/', '/gallery/', '/pl/gallery/'].map((url) =>
          cache.add(url).catch(() => undefined)
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              return caches.delete(cacheName)
            }
            return undefined
          })
        )
      ),
      self.clients.claim(),
    ])
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Writes, APIs and cross-origin traffic always stay outside the service worker.
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  // Range requests (video/audio seeking) must be handled natively: Chrome
  // rejects any service-worker response to a Range request that isn't a
  // 206/416, and our offline fallback returns 503, which surfaces as an
  // "unexpected error" for media like rise.webm.
  if (event.request.headers.has('range')) return

  if (STATIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        const revalidate = fetch(event.request)
          .then((fetched) => {
            if (fetched.ok && fetched.type !== 'opaque') {
              event.waitUntil(cache.put(event.request, fetched.clone()).then(() => trimCache(cache, MAX_STATIC_CACHE_ENTRIES)))
            }
            return fetched
          })
          .catch(() => null)

        // Static assets are stale-while-revalidate: repeat views stay instant,
        // while stable public URLs refresh automatically after a deploy.
        if (cached) {
          event.waitUntil(revalidate.then(() => undefined))
          return cached
        }

        const fetched = await revalidate
        if (fetched) return fetched
        event.waitUntil(notifyOffline(url.pathname))
        return offlineAssetResponse()
      })
    )
    return
  }

  if (event.request.headers.get('accept')?.includes('text/html')) {
    const canCache = !url.search && !PRIVATE_HTML_PATTERN.test(url.pathname)

    if (!canCache) {
      event.respondWith(
        fetch(event.request).catch(() => {
          event.waitUntil(notifyOffline(url.pathname))
          return offlineHtmlResponse()
        })
      )
      return
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME).then(async (cache) => {
                await cache.put(event.request, response.clone())
                await trimCache(cache, MAX_PAGE_CACHE_ENTRIES)
              })
            )
          }
          return response
        })
        .catch(async () => {
          event.waitUntil(notifyOffline(url.pathname))
          return cacheMatchOr(event.request, offlineHtmlResponse)
        })
    )
    return
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      event.waitUntil(notifyOffline(url.pathname))
      return cacheMatchOr(event.request, offlineAssetResponse)
    })
  )
})
