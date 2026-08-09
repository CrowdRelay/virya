import type { APIRoute } from "astro"

const ARTIST = "virya"
const APP_ID = import.meta.env.BANDSINTOWN_APP_ID || "virya-website"
const REQUEST_TIMEOUT_MS = 8_000
const MAX_RESPONSE_BYTES = 512 * 1024
const MAX_EVENTS = 100
const JSON_HEADERS = { "Content-Type": "application/json" }
const SUCCESS_CACHE =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
const ERROR_CACHE = "public, max-age=60, s-maxage=300"

const json = (data: unknown, cacheControl: string) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...JSON_HEADERS, "Cache-Control": cacheControl },
  })

export const GET: APIRoute = async () => {
  try {
    const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${encodeURIComponent(APP_ID)}&date=upcoming`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      return json([], ERROR_CACHE)
    }
    const declared = Number(res.headers.get("content-length") ?? "0")
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      throw new Error("Bandsintown response too large")
    }
    const text = await res.text()
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("Bandsintown response too large")
    }
    const data = JSON.parse(text)
    const events = Array.isArray(data) ? data.slice(0, MAX_EVENTS) : []
    return json(events, SUCCESS_CACHE)
  } catch (err) {
    console.error("[bandsintown]", err)
    return json([], ERROR_CACHE)
  }
}
