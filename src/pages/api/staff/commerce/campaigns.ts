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
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {}
    if (record.kind === "beacon_network") {
      const action = typeof record.action === "string" ? record.action : ""
      const idempotencyKey = forwardedMutationKey(request, `staff-latarnik-network-${action || "mutation"}`)
      if (action === "discover") {
        const countryCode = typeof record.countryCode === "string" ? record.countryCode.trim().toUpperCase() : "PL"
        const targetCount = Number(record.targetCount)
        if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isInteger(targetCount) || targetCount < 1 || targetCount > 500) {
          return areaJson({ error: "Invalid discovery request" }, 400)
        }
        return areaJson(await staffApiRequest("admin/autopilot/beacon-network", {
          method: "POST", idempotencyKey, body: { action, countryCode, targetCount },
        }), 202)
      }
      if (action === "approve") {
        const beaconId = typeof record.beaconId === "string" ? record.beaconId : ""
        const evidence = typeof record.consentEvidenceUrl === "string" ? record.consentEvidenceUrl.trim() : ""
        let validEvidence = false
        try { const parsed = new URL(evidence); validEvidence = parsed.protocol === "https:" && Boolean(parsed.hostname) } catch { /* invalid */ }
        if (!/^[0-9a-f-]{36}$/i.test(beaconId) || record.sourceVerified !== true || record.marketingEmailConsentConfirmed !== true || !validEvidence) {
          return areaJson({ error: "Candidate review evidence is incomplete" }, 400)
        }
        return areaJson(await staffApiRequest("admin/autopilot/beacon-network", {
          method: "POST", idempotencyKey, body: {
            action, beaconId, sourceVerified: true, marketingEmailConsentConfirmed: true, consentEvidenceUrl: evidence,
          },
        }))
      }
      if (action === "queue_invites") {
        const beaconIds = Array.isArray(record.beaconIds) ? record.beaconIds.filter((value): value is string => typeof value === "string") : []
        const unique = [...new Set(beaconIds)]
        const ttlDays = Number(record.ttlDays ?? 14)
        const radiusKm = Number(record.radiusKm ?? 100)
        const locale = typeof record.locale === "string" ? record.locale : "pl"
        if (unique.length === 0 || unique.length > 200 || unique.length !== beaconIds.length || !unique.every(id => /^[0-9a-f-]{36}$/i.test(id))
          || !Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 90 || !Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 500
          || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
          return areaJson({ error: "Invalid invite batch" }, 400)
        }
        return areaJson(await staffApiRequest("admin/autopilot/beacon-network", {
          method: "POST", idempotencyKey, body: { action, beaconIds: unique, ttlDays, radiusKm, locale },
        }), 202)
      }
      return areaJson({ error: "Unsupported Latarnik network action" }, 400)
    }
    if (record.kind === "beacon_release") {
      const action = typeof record.action === "string" ? record.action : ""
      const campaignId = typeof record.campaignId === "string" ? record.campaignId : ""
      const beaconId = typeof record.beaconId === "string" ? record.beaconId : ""
      const idempotencyKey = forwardedMutationKey(request, `staff-latarnik-${action || "mutation"}`)
      if (action === "create") {
        const payload = {
          slug: record.slug,
          title: record.title,
          sku: record.sku,
          claimDeadline: record.claimDeadline,
        }
        return areaJson(await staffApiRequest("admin/autopilot/beacon-release-campaigns", { method: "POST", idempotencyKey, body: payload }), 201)
      }
      if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return areaJson({ error: "Invalid campaign" }, 400)
      if (action === "launch" || action === "close") {
        return areaJson(await staffApiRequest(`admin/autopilot/beacon-release-campaigns/${campaignId}/${action}`, { method: "POST", idempotencyKey, body: {} }))
      }
      if (action === "recipient-status" && /^[0-9a-f-]{36}$/i.test(beaconId) && typeof record.status === "string") {
        return areaJson(await staffApiRequest(`admin/autopilot/beacon-release-campaigns/${campaignId}/recipients/${beaconId}`, {
          method: "POST", idempotencyKey, body: { status: record.status },
        }))
      }
      return areaJson({ error: "Unsupported Latarnik campaign action" }, 400)
    }
    return areaJson(await staffApiRequest("admin/reward-campaigns", { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body }), 201)
  } catch (error) {
    console.error("[staff-commerce-campaign-create]", error)
    return areaJson({ error: "Could not update campaign" }, status(error))
  }
}
