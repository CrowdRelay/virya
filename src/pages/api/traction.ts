import { getTraction } from "../../server/traction.ts"
import { readDelta, recordSnapshot } from "../../server/tractionHistory.ts"
import type { APIRoute } from "astro"

export const prerender = false

const SUCCESS_CACHE =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
const DEGRADED_CACHE = "public, max-age=60, s-maxage=300"

export const GET: APIRoute = async () => {
  const traction = await getTraction()
  // First healthy read of the day lays down that day's snapshot, so the series
  // builds itself without a scheduler. The two calls are independent and run
  // together; neither is allowed to fail the response — the numbers matter
  // more than their history.
  const [delta] = await Promise.all([
    readDelta(traction).catch(() => ({ since: null, change: {} })),
    recordSnapshot(traction).catch(() => undefined),
  ])
  return new Response(JSON.stringify({ ...traction, delta }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": traction.degraded ? DEGRADED_CACHE : SUCCESS_CACHE,
    },
  })
}
