import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../server/mutationSafety"

export const prerender = false
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  try {
    return areaJson(await staffApiRequest("admin/accounting/ticket-sales/finalize", { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body, timeoutMs: 20_000 }), 201)
  } catch (error) {
    console.error("[staff-accounting-finalize]", error)
    const status = error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: "Could not finalize accounting document" }, status)
  }
}
