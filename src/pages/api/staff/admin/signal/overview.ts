import type { APIRoute } from "astro"
import { areaJson } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
} from "../../../../../server/staffQrApi"

export const prerender = false

const statusFor = (error: unknown) => {
  if (!(error instanceof StaffQrUpstreamError)) return 502
  if (error.status === 401 || error.status === 403) return 502
  if (error.status === 429) return 503
  return [400, 404, 503].includes(error.status) ? error.status : 502
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)

  try {
    const overview = await staffApiRequest("admin/signal/overview", {
      timeoutMs: 10_000,
    })
    return areaJson(overview)
  } catch (error) {
    console.warn("[staff-admin-signal-overview] upstream unavailable", {
      status: error instanceof StaffQrUpstreamError ? error.status : undefined,
      kind: error instanceof Error ? error.name : typeof error,
    })
    return areaJson(
      { error: "Signal control plane temporarily unavailable" },
      statusFor(error),
    )
  }
}
