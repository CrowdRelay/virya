import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"

export const prerender = false
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const status = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id?.trim() ?? ""
  if (!UUID.test(id)) return areaJson({ error: "Invalid campaign id" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/reward-campaigns/${encodeURIComponent(id)}/schedule`, { method: "POST" }))
  } catch (error) {
    console.error("[staff-commerce-campaign-schedule]", error)
    return areaJson({ error: "Could not schedule reward campaign" }, status(error))
  }
}
