import type { APIRoute } from "astro"

const ARTIST = "virya"
const APP_ID = import.meta.env.BANDSINTOWN_APP_ID || "virya-website"

// Disable SSL verification for dev environment
if (import.meta.env.DEV) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
}

export const GET: APIRoute = async () => {
  try {
    const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${encodeURIComponent(APP_ID)}&date=upcoming`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
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
