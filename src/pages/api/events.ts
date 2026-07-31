import type { APIRoute } from "astro"
import { loadLiveEvents } from "../../server/liveEvents"

export const prerender = false

export const GET: APIRoute = async () => {
  const { events, degraded } = await loadLiveEvents()
  return new Response(JSON.stringify({ events, degraded }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": degraded
        ? "public, max-age=20, s-maxage=60, stale-while-revalidate=120"
        : "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
    },
  })
}
