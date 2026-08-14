import type { APIRoute } from "astro"
import { areaJson } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
} from "../../../../../server/staffQrApi"

export const prerender = false

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError &&
  [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies))
    return areaJson({ error: "Unauthorized" }, 401)

  try {
    const [summaryResult, deliveriesResult, outboxResult] = await Promise.allSettled([
      staffApiRequest("admin/ops/summary", { timeoutMs: 8_000 }),
      staffApiRequest("admin/ops/deliveries?status=dead&limit=50", {
        timeoutMs: 5_000,
      }),
      staffApiRequest("admin/ops/outbox?status=dead&limit=50", {
        timeoutMs: 5_000,
      }),
    ])

    // Queue summary is the primary control-plane read. Dead-item lists are
    // secondary diagnostics and must not blank the whole Ops tab.
    if (summaryResult.status === "rejected") throw summaryResult.reason

    const degraded = [
      deliveriesResult.status === "rejected" ? "dead_deliveries" : null,
      outboxResult.status === "rejected" ? "dead_outbox" : null,
    ].filter((value): value is string => value !== null)

    return areaJson({
      summary: summaryResult.value,
      deadDeliveries: deliveriesResult.status === "fulfilled" ? deliveriesResult.value : [],
      deadOutbox: outboxResult.status === "fulfilled" ? outboxResult.value : [],
      degraded,
    })
  } catch (error) {
    console.error("[staff-admin-ops-summary]", error)
    return areaJson(
      { error: "Operations control plane temporarily unavailable" },
      statusFor(error),
    )
  }
}
