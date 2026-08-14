import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const statusFor = (error: unknown) => error instanceof StaffQrUpstreamError ? error.status : 502
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  try {
    return areaJson(await staffApiRequest("admin/ecosystem/checklists/emit-due", {
      method: "POST",
      idempotencyKey: `checklist-due-${crypto.randomUUID()}`,
      correlationId: `checklist-due:${crypto.randomUUID()}`,
      timeoutMs: 10_000,
    }))
  } catch (error) {
    return areaJson({ error: "Checklist emission failed" }, statusFor(error))
  }
}
