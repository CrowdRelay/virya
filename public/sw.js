const CACHE_NAME = 'virya-v16'
const STATIC_CACHE = 'virya-static-v16'
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



const PUSH_ACK_BASE = 'https://signal-api.virya.music/v1/public/push/deliveries/'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,200}$/

function validPushPayload(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.delivery_id === 'string' &&
      UUID_PATTERN.test(value.delivery_id) &&
      typeof value.ack_token === 'string' &&
      ACK_TOKEN_PATTERN.test(value.ack_token) &&
      typeof value.title === 'string' &&
      value.title.length > 0 &&
      value.title.length <= 160 &&
      typeof value.body === 'string' &&
      value.body.length > 0 &&
      value.body.length <= 1200 &&
      typeof value.target_path === 'string' &&
      value.target_path.startsWith('/') &&
      !value.target_path.startsWith('//') &&
      value.target_path.length <= 512
  )
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function acknowledgeDisplayedPush(deliveryId, ackToken) {
  const url = `${PUSH_ACK_BASE}${encodeURIComponent(deliveryId)}/ack`
  for (const waitMs of [0, 500, 2000]) {
    if (waitMs > 0) await delay(waitMs)
    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ack_token: ackToken }),
      })
      if (response.ok) return true
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        return false
      }
    } catch {
      // Retry only the acknowledgement; never display a second notification.
    }
  }
  return false
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload
      try {
        payload = event.data?.json()
      } catch {
        return
      }
      if (!validPushPayload(payload)) return
      const tag =
        typeof payload.collapse_key === 'string' && payload.collapse_key.length <= 160
          ? payload.collapse_key
          : `virya-${payload.delivery_id}`
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        tag,
        renotify: false,
        data: {
          deliveryId: payload.delivery_id,
          targetPath: payload.target_path,
        },
      })
      await acknowledgeDisplayedPush(payload.delivery_id, payload.ack_token)
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification?.data?.targetPath
  const targetPath =
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && path.length <= 512
      ? path
      : '/pl/my-signal/'
  const targetUrl = new URL(targetPath, self.location.origin).toString()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        if ('navigate' in client) await client.navigate(targetUrl)
        if ('focus' in client) await client.focus()
        return
      }
      await self.clients.openWindow(targetUrl)
    })()
  )
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
