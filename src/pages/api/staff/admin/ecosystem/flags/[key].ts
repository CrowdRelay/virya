import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../../../server/mutationSafety"

export const prerender = false
const KEY = /^[a-z][a-z0-9_.-]{2,63}$/
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, params, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  const key = params.key ?? ""
  if (!KEY.test(key)) return areaJson({ error: "Invalid flag" }, 400)
  let body: { enabled?: unknown; reason?: unknown }
  try { body = await request.json() } catch { return areaJson({ error: "Invalid request" }, 400) }
  if (typeof body.enabled !== "boolean" || (body.reason != null && (typeof body.reason !== "string" || body.reason.length > 500))) {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const flagIntent = { enabled: body.enabled, reason: typeof body.reason === "string" ? body.reason : null }
  const idempotencyKey = forwardedMutationKey(request, "ecosystem-flag")
  try {
    return areaJson(await staffApiRequest(`admin/ecosystem/flags/${encodeURIComponent(key)}`, {
      method: "POST",
      body: flagIntent,
      idempotencyKey,
      correlationId: idempotencyKey,
      timeoutMs: 8_000,
    }))
  } catch (error) {
    return areaJson({ error: "Feature flag update failed" }, statusFor(error))
  }
}
