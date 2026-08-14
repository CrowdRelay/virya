import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../../../../server/mutationSafety"

export const prerender = false
const SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const ITEM = /^[a-z][a-z0-9_.-]{2,63}$/
const STATUSES = new Set(["pending", "done", "blocked", "skipped"])
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, params, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  const slug = params.slug ?? ""
  const item = params.item ?? ""
  if (!SLUG.test(slug) || !ITEM.test(item)) return areaJson({ error: "Invalid checklist item" }, 400)
  let body: { status?: unknown; note?: unknown }
  try { body = await request.json() } catch { return areaJson({ error: "Invalid request" }, 400) }
  if (typeof body.status !== "string" || !STATUSES.has(body.status) || (body.note != null && (typeof body.note !== "string" || body.note.length > 1000))) {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const checklistIntent = { status: body.status, note: typeof body.note === "string" ? body.note : null }
  const idempotencyKey = forwardedMutationKey(request, "checklist-item")
  try {
    return areaJson(await staffApiRequest(`admin/ecosystem/checklists/${encodeURIComponent(slug)}/${encodeURIComponent(item)}`, {
      method: "POST",
      body: checklistIntent,
      idempotencyKey,
      correlationId: idempotencyKey,
      timeoutMs: 8_000,
    }))
  } catch (error) {
    return areaJson({ error: "Checklist update failed" }, statusFor(error))
  }
}
