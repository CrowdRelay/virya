import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { mutationKeyForRequest } from "../../../../../server/mutationSafety"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  let body: Record<string, unknown>
  try { body = await readSmallJsonObject(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  const eventSlug = String(body.eventSlug ?? "").trim()
  const poolSlug = String(body.poolSlug ?? "").trim()
  const fanEmail = String(body.fanEmail ?? "").trim().toLowerCase()
  const claimExpiresHours = Number(body.claimExpiresHours ?? 72)
  if (!SLUG.test(eventSlug) || !SLUG.test(poolSlug) || !EMAIL.test(fanEmail) || !Number.isInteger(claimExpiresHours) || claimExpiresHours < 1 || claimExpiresHours > 720) {
    return areaJson({ error: "Invalid admission pass request" }, 400)
  }
  try {
    return areaJson(await staffApiRequest("admin/admission/passes", {
      method: "POST",
      body: {
        event_slug: eventSlug,
        pool_slug: poolSlug,
        fan_email: fanEmail,
        claim_expires_hours: claimExpiresHours,
      },
      idempotencyKey: mutationKeyForRequest(request, "staff-pass", {
        eventSlug, poolSlug, fanEmail, claimExpiresHours,
      }),
      timeoutMs: 12_000,
    }))
  } catch (error) {
    console.error("[staff-admin-admission-issue]", error)
    const status = error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: "Admission pass could not be issued" }, status)
  }
}
