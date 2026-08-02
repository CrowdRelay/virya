import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
  type StaffQrOverview,
} from "../../../../server/staffQrApi"

export const prerender = false

type Health = { status: string }
type PublicEvents = { events: unknown[] }
type Cities = { items: unknown[] }
type SourceName = "live" | "ready" | "operations" | "events" | "cities"

const statusFor = (error: unknown) => {
  if (!(error instanceof StaffQrUpstreamError)) return 502
  // A valid staff session must not be turned into a client-side logout because
  // the server-to-server CrowdRelay credential is stale or misconfigured.
  if (error.status === 401 || error.status === 403) return 502
  if (error.status === 429) return 503
  return [400, 404, 503].includes(error.status) ? error.status : 502
}

const logFailure = (source: SourceName, error: unknown) => {
  const status = error instanceof StaffQrUpstreamError ? error.status : undefined
  const kind = error instanceof Error ? error.name : typeof error
  console.warn("[staff-admin-overview] upstream unavailable", {
    source,
    status,
    kind,
  })
}

const valueOr = <T>(result: PromiseSettledResult<T>, fallback: T) =>
  result.status === "fulfilled" ? result.value : fallback

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)

  const results = await Promise.allSettled([
    staffApiRequest<Health>("health/live", { timeoutMs: 4_000 }),
    staffApiRequest<Health>("health/ready", { timeoutMs: 4_000 }),
    staffApiRequest<StaffQrOverview>("admin/event-qr/overview", {
      timeoutMs: 8_000,
    }),
    staffApiRequest<PublicEvents>("public/events?limit=100", {
      timeoutMs: 8_000,
    }),
    staffApiRequest<Cities>("public/cities?limit=100", { timeoutMs: 8_000 }),
  ] as const)

  const names: SourceName[] = ["live", "ready", "operations", "events", "cities"]
  const unavailableSources = results.flatMap((result, index) =>
    result.status === "rejected" ? [names[index]] : [],
  )
  const failures = results.flatMap(result =>
    result.status === "rejected" ? [result.reason] : [],
  )

  if (failures.length === results.length) {
    const error = failures[0]
    const firstFailureIndex = results.findIndex(result => result.status === "rejected")
    logFailure(names[firstFailureIndex] ?? "live", error)
    return areaJson(
      { error: "Admin overview temporarily unavailable" },
      statusFor(error),
    )
  }

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      logFailure(names[index], result.reason)
    }
  }

  const [liveResult, readyResult, operationsResult, eventsResult, citiesResult] = results
  const live = valueOr(liveResult, { status: "unavailable" })
  const ready = valueOr(readyResult, { status: "unavailable" })
  const operations = valueOr(operationsResult, { events: [], campaigns: [] })
  const events = valueOr(eventsResult, { events: [] })
  const cities = valueOr(citiesResult, { items: [] })

  return areaJson({
    services: { live: live.status, ready: ready.status },
    operations,
    publicEvents: events.events,
    cities: cities.items,
    degraded: {
      active: unavailableSources.length > 0,
      unavailableSources,
    },
    generatedAt: new Date().toISOString(),
  })
}
