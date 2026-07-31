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

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)

  try {
    const [live, ready, operations, events, cities] = await Promise.all([
      staffApiRequest<Health>("health/live", { timeoutMs: 4_000 }),
      staffApiRequest<Health>("health/ready", { timeoutMs: 4_000 }),
      staffApiRequest<StaffQrOverview>("admin/event-qr/overview", {
        timeoutMs: 8_000,
      }),
      staffApiRequest<PublicEvents>("public/events?limit=100", {
        timeoutMs: 8_000,
      }),
      staffApiRequest<Cities>("public/cities?limit=100", { timeoutMs: 8_000 }),
    ])

    return areaJson({
      services: { live: live.status, ready: ready.status },
      operations,
      publicEvents: events.events,
      cities: cities.items,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[staff-admin-overview]", error)
    return areaJson({ error: "Admin overview temporarily unavailable" }, statusFor(error))
  }
}
