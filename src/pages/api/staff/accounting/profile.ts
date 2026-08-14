import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../server/mutationSafety"

export const prerender = false

const status = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  try {
    return areaJson(await staffApiRequest("admin/accounting/profile"))
  } catch (error) {
    console.error("[staff-accounting-profile-get]", error)
    return areaJson({ error: "Accounting profile unavailable" }, status(error))
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  try {
    return areaJson(await staffApiRequest("admin/accounting/profile", { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body }))
  } catch (error) {
    console.error("[staff-accounting-profile-post]", error)
    return areaJson({ error: "Could not save accounting profile" }, status(error))
  }
}
