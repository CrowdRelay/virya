import { getTraction } from "../../server/traction.ts"
import type { APIRoute } from "astro"

export const prerender = false

const SUCCESS_CACHE =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
const DEGRADED_CACHE = "public, max-age=60, s-maxage=300"

export const GET: APIRoute = async () => {
  const traction = await getTraction()
  return new Response(JSON.stringify(traction), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": traction.degraded ? DEGRADED_CACHE : SUCCESS_CACHE,
    },
  })
}
