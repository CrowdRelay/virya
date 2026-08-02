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
    const [summary, deadDeliveries, deadOutbox] = await Promise.all([
      staffApiRequest("admin/ops/summary", { timeoutMs: 8_000 }),
      staffApiRequest("admin/ops/deliveries?status=dead&limit=50", {
        timeoutMs: 8_000,
      }),
      staffApiRequest("admin/ops/outbox?status=dead&limit=50", {
        timeoutMs: 8_000,
      }),
    ])

    return areaJson({ summary, deadDeliveries, deadOutbox })
  } catch (error) {
    console.error("[staff-admin-ops-summary]", error)
    return areaJson(
      { error: "Operations control plane temporarily unavailable" },
      statusFor(error),
    )
  }
}
