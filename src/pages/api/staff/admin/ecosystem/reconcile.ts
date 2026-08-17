import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  let body: Record<string, unknown> = {}
  try { body = await readSmallJsonObject(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  const trigger = body.trigger == null ? "manual" : body.trigger
  if (trigger !== "manual" && trigger !== "bandsintown_sync") return areaJson({ error: "Invalid trigger" }, 400)
  const idempotencyKey = request.headers.get("idempotency-key") ?? `${trigger}-${new Date().toISOString().slice(0, 13)}-${crypto.randomUUID()}`
  try {
    return areaJson(await staffApiRequest("admin/ecosystem/reconcile", {
      method: "POST",
      body: { trigger },
      idempotencyKey,
      correlationId: idempotencyKey,
      timeoutMs: 20_000,
    }))
  } catch (error) {
    return areaJson({ error: "Reconciliation failed" }, statusFor(error))
  }
}
