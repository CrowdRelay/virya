import type { APIRoute } from "astro"

const ARTIST = "virya"
const APP_ID = import.meta.env.BANDSINTOWN_APP_ID || "virya-website"
const REQUEST_TIMEOUT_MS = 8_000

export const GET: APIRoute = async () => {
  try {
    const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${encodeURIComponent(APP_ID)}&date=upcoming`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
      })
    }
    const data = await res.json()
    const events = Array.isArray(data) ? data : []
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    })
  } catch (err) {
    console.error("[bandsintown]", err)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}
