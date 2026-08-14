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

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  try {
    return areaJson(await staffApiRequest("admin/merch/catalog", { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body }))
  } catch (error) {
    console.error("[staff-commerce-catalog]", error)
    return areaJson({ error: "Could not save catalog" }, status(error))
  }
}
