import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"

export const prerender = false
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  let body: { limit?: unknown } = {}
  try { body = await request.json() } catch { return areaJson({ error: "Invalid request" }, 400) }
  const limit = Number(body.limit ?? 1024)
  if (!Number.isInteger(limit) || limit < 1 || limit > 4096) return areaJson({ error: "Invalid limit" }, 400)
  const idempotencyKey = request.headers.get("idempotency-key") ?? `audit-proof-${new Date().toISOString().slice(0, 13)}-${crypto.randomUUID()}`
  try {
    return areaJson(await staffApiRequest("admin/proofs/audit-batches", {
      method: "POST",
      body: { limit },
      idempotencyKey,
      correlationId: idempotencyKey,
      timeoutMs: 20_000,
    }))
  } catch (error) {
    return areaJson({ error: "Audit proof creation failed" }, statusFor(error))
  }
}
