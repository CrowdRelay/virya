import { defineMiddleware } from "astro:middleware"

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(self), camera=(), microphone=(), payment=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data: https:; media-src 'self'; font-src 'self' data: https:; script-src 'self' 'unsafe-inline' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rest.bandsintown.com; frame-src https://open.spotify.com https://js.stripe.com https://www.youtube-nocookie.com; form-action 'self'; frame-ancestors 'self'",
} as const

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()
  const headers = new Headers(response.headers)

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value)
    }
  }

  // Netlify's static _headers file does not apply to Functions. Preserve
  // explicit public caching (the Bandsintown proxy) and avoid disabling CDN
  // caching on public SSR show pages.
  if (
    context.url.pathname.startsWith("/api/") &&
    !headers.has("Cache-Control")
  ) {
    headers.set("Cache-Control", "no-store")
  }

  // Cloning also covers redirects, whose native Response headers are immutable.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})
