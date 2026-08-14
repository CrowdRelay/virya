import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { mutationKeyForRequest } from "../../../../../server/mutationSafety"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const REFERENCE = /^[A-Za-z0-9_-]{4,100}$/

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  let body: Record<string, unknown>
  try { body = await readSmallJsonObject(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  const publicReference = String(body.publicReference ?? "").trim()
  if (!REFERENCE.test(publicReference)) return areaJson({ error: "Invalid pass reference" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/admission/passes/${encodeURIComponent(publicReference)}/revoke`, {
      method: "POST",
      idempotencyKey: mutationKeyForRequest(request, "staff-revoke", { publicReference }),
      timeoutMs: 12_000,
    }))
  } catch (error) {
    console.error("[staff-admin-admission-revoke]", error)
    const status = error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: "Admission pass could not be revoked" }, status)
  }
}
