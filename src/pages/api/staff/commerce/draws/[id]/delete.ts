import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../../../server/mutationSafety"

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
  if (!UUID.test(id)) return areaJson({ error: "Invalid draw id" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/reward-draws/${encodeURIComponent(id)}/delete`, {
      method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"),
    }))
  } catch (error) {
    console.error("[staff-commerce-draw-delete]", error)
    return areaJson({ error: "Could not delete reward draw" }, status(error))
  }
}
