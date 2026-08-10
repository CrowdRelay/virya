import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"

export const prerender = false

export const GET: APIRoute = async ({ cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const requestId = params.request_id?.trim() ?? ""
  if (!requestId || requestId.length > 128 || !/^[!-~]+$/.test(requestId)) {
    return areaJson({ error: "Invalid request ID" }, 400)
  }
  try {
    const timeline = await staffApiRequest(
      `admin/ops/operations/${encodeURIComponent(requestId)}`,
      { timeoutMs: 8_000 },
    )
    return areaJson(timeline)
  } catch (error) {
    const status = error instanceof StaffQrUpstreamError && [400, 401, 404, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: status === 404 ? "Operation not found" : "Operations timeline temporarily unavailable" }, status)
  }
}
