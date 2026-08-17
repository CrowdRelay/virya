import { defineMiddleware } from "astro:middleware"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "geolocation=(self), camera=(), microphone=(), payment=(self)",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data: https:; media-src 'self'; font-src 'self' data: https:; script-src 'self' 'unsafe-inline' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://signal-api.virya.music; frame-src https://open.spotify.com https://js.stripe.com https://www.youtube-nocookie.com; form-action 'self'; frame-ancestors 'self'",
} as const

function requestId(request: Request, isPrerendered: boolean): string {
  if (isPrerendered) {
    return "static"
  }
  const provided = request.headers.get("x-request-id")?.trim()
  return provided && REQUEST_ID_PATTERN.test(provided)
    ? provided
    : crypto.randomUUID()
}

function isPrivatePath(pathname: string): boolean {
  return (
    pathname.startsWith("/staff") ||
    pathname.startsWith("/tickets/") ||
    pathname.startsWith("/pl/tickets/") ||
    pathname === "/win" ||
    pathname === "/pl/win"
  )
}

function problemResponse(pathname: string, id: string): Response {
  if (pathname.startsWith("/api/")) {
    return new Response(
      JSON.stringify({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Operacja nie powiodła się. Zachowaj identyfikator żądania.",
        request_id: id,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      },
    )
  }

  const escapedId = id.replace(/[^A-Za-z0-9._:-]/g, "")
  return new Response(
    `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Virya — błąd</title><body style="margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui;padding:32px"><main style="max-width:720px;margin:12vh auto"><p style="color:#fbbf24;font-weight:900;letter-spacing:.16em">VIRYA / DIAGNOSTYKA</p><h1>Nie udało się wyrenderować strony</h1><p style="color:#d4d4d8;line-height:1.6">Odśwież stronę. Jeśli błąd wróci, podaj identyfikator <code>${escapedId}</code>.</p><button onclick="location.reload()" style="min-height:44px;border:0;background:#fbbf24;padding:0 16px;font-weight:900">ODŚWIEŻ</button></main></body></html>`,
    {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    },
  )
}

export const onRequest = defineMiddleware(async (context, next) => {
  const isPrerendered = Boolean((context as unknown as { isPrerendered?: boolean }).isPrerendered)
  const id = requestId(context.request, isPrerendered)
  const startedAt = performance.now()
  let response: Response

  try {
    response = await next()
  } catch (error) {
    console.error("[virya:request-failure]", {
      requestId: id,
      method: context.request.method,
      pathname: context.url.pathname,
      error,
    })
    response = problemResponse(context.url.pathname, id)
  }

  const headers = new Headers(response.headers)

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value)
  }

  headers.set("X-Request-ID", id)
  headers.set("Server-Timing", `app;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`)

  // Netlify's static _headers file does not apply to Functions. Preserve
  // explicit public caching and avoid disabling CDN caching on public SSR pages.
  if (
    (context.url.pathname.startsWith("/api/") || isPrivatePath(context.url.pathname)) &&
    !headers.has("Cache-Control")
  ) {
    headers.set("Cache-Control", "private, no-store")
  }

  if (isPrivatePath(context.url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    headers.set("Referrer-Policy", "no-referrer")
  }

  if (response.status >= 500) {
    headers.set("Cache-Control", "private, no-store")
  }

  // Cloning also covers redirects, whose native Response headers are immutable.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})
