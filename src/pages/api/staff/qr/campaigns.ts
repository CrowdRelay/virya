import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffQrRequest,
  type StaffQrCampaign,
} from "../../../../server/staffQrApi"

export const prerender = false

const upstreamStatus = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }
  try {
    const result = await staffQrRequest<{ campaigns: StaffQrCampaign[] }>(
      "admin/event-qr/campaigns?limit=100",
    )
    return areaJson(result)
  } catch (error) {
    console.error("[staff-qr-campaigns-list]", error)
    return areaJson({ error: "Campaigns temporarily unavailable" }, upstreamStatus(error))
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }

  let body: unknown
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  try {
    const campaign = await staffQrRequest<StaffQrCampaign>(
      "admin/event-qr/campaigns",
      { method: "POST", body },
    )
    return areaJson(campaign, 201)
  } catch (error) {
    console.error("[staff-qr-campaigns-create]", error)
    return areaJson({ error: "Could not create campaign" }, upstreamStatus(error))
  }
}
