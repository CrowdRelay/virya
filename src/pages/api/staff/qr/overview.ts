import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffQrRequest,
  type StaffQrOverview,
} from "../../../../server/staffQrApi"

export const prerender = false

const upstreamStatus = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }

  try {
    const overview = await staffQrRequest<StaffQrOverview>(
      "admin/event-qr/overview",
    )
    return areaJson(overview)
  } catch (error) {
    console.error("[staff-qr-overview]", error)
    return areaJson(
      { error: "QR overview temporarily unavailable" },
      upstreamStatus(error),
    )
  }
}
