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
        ? "public, max-age=30, s-maxage=120, stale-while-revalidate=1800"
        : "public, max-age=120, s-maxage=600, stale-while-revalidate=86400",
    },
  })
}
