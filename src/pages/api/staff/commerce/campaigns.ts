import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"
import { forwardedMutationKey, mutationPrefix } from "../../../../server/mutationSafety"

export const prerender = false

class StageError extends Error {
  constructor(message: string, readonly httpStatus: number) {
    super(message)
    this.name = "StageError"
  }
}
const status = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const mutation = [record.kind, record.action]
    .filter((value): value is string => typeof value === "string" && /^[a-z_]{1,40}$/.test(value))
    .join("/") || "reward-campaign"
  try {
    if (record.kind === "beacon_network") {
      const action = typeof record.action === "string" ? record.action : ""
      const idempotencyKey = forwardedMutationKey(request, mutationPrefix("staff-latarnik-network", action))
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
      if (action === "single_invite") {
        const beaconId = typeof record.beaconId === "string" ? record.beaconId : ""
        const ttlDays = Number(record.ttlDays ?? 14)
        const radiusKm = Number(record.radiusKm ?? 100)
        const locale = typeof record.locale === "string" ? record.locale : "pl"
        if (!/^[0-9a-f-]{36}$/i.test(beaconId) || !Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30
          || !Number.isInteger(radiusKm) || radiusKm < 10 || radiusKm > 500 || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
          return areaJson({ error: "Invalid single invite" }, 400)
        }
        const upstream = await staffApiRequest<Record<string, unknown>>(`admin/autopilot/beacons/${beaconId}/signal-invites`, {
          method: "POST", body: { ttlDays, radiusKm, locale },
        })
        const displayName = typeof upstream.displayName === "string" ? upstream.displayName.trim() : ""
        const inviteUrl = typeof upstream.inviteUrl === "string" ? upstream.inviteUrl.trim() : ""
        const expiresAt = typeof upstream.expiresAt === "string" ? upstream.expiresAt.trim() : ""
        let validInvite = false
        try {
          const parsed = new URL(inviteUrl)
          const invite = parsed.searchParams.getAll("invite")
          validInvite = parsed.protocol === "https:" && parsed.hostname === "virya.music"
            && ["/latarnik", "/latarnik/", "/pl/latarnik", "/pl/latarnik/"].includes(parsed.pathname)
            && parsed.username === "" && parsed.password === "" && parsed.hash === ""
            && [...parsed.searchParams.keys()].every(key => key === "invite")
            && invite.length === 1 && /^[A-Za-z0-9_-]{24,128}$/.test(invite[0] ?? "")
        } catch { /* invalid upstream capability */ }
        if (!displayName || displayName.length > 200 || !validInvite || !Number.isFinite(Date.parse(expiresAt))) {
          throw new Error("Invalid Latarnik invite response")
        }
        // The browser needs only the one-time URL to render/copy the QR. Do not
        // forward the standalone raw inviteToken returned by CrowdRelay.
        return areaJson({ displayName, inviteUrl, expiresAt }, 201)
      }
      if (action === "test_beacon") {
        // Discovery plus a consent review is the right gate for strangers found
        // on the public web and the wrong one for putting our own people on the
        // network to exercise it. Staff-minted, so identity is known and the
        // outreach consent is our own.
        const displayNameInput = typeof record.displayName === "string" ? record.displayName.trim() : ""
        const contactEmail = typeof record.contactEmail === "string" ? record.contactEmail.trim() : ""
        const beaconKind = typeof record.beaconKind === "string" ? record.beaconKind : "promoter"
        const cityId = typeof record.cityId === "string" && record.cityId ? record.cityId : null
        if (!displayNameInput || displayNameInput.length > 200
          || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 320
          || !/^[a-z_]{3,32}$/.test(beaconKind)
          || (cityId !== null && !/^[0-9a-f-]{36}$/i.test(cityId))) {
          return areaJson({ error: "Invalid test beacon" }, 400)
        }
        // Report which leg failed and what CrowdRelay said. The shared catch
        // below collapses everything into one message, which is fine for the
        // established actions and useless for a two-call flow.
        const stage = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
          try { return await run() } catch (error) {
            const upstream = error instanceof StaffQrUpstreamError
              ? `${error.status}${error.detail ? ` ${String(error.detail).slice(0, 160)}` : ""}`
              : String((error as Error)?.message ?? "unknown").slice(0, 160)
            throw new StageError(`${label}: ${upstream}`, error instanceof StaffQrUpstreamError ? error.status : 502)
          }
        }
        const created = await stage("beacon create", () => staffApiRequest<Record<string, unknown>>("admin/autopilot/beacons", {
          method: "POST", idempotencyKey,
          body: {
            beacon_id: null, city_id: cityId, beacon_kind: beaconKind,
            display_name: displayNameInput, contact_email: contactEmail,
            destination_url: null, source_url: null,
            active: true, verified: true, accepts_outreach: true, do_not_contact: false,
            relationship_score: 100, relevance_basis_points: 10_000, confidence_basis_points: 10_000,
            metadata: { origin: "staff_test_beacon" }, expected_version: 0,
          },
        }))
        const beacon = created.beacon && typeof created.beacon === "object" ? created.beacon as Record<string, unknown> : {}
        const beaconId = [created.beaconId, created.beacon_id, created.id, beacon.id]
          .find((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))
        if (!beaconId) {
          throw new StageError(`beacon create: no id in ${Object.keys(created).join(",").slice(0, 120)}`, 502)
        }

        const upstream = await stage("invite", () => staffApiRequest<Record<string, unknown>>(`admin/autopilot/beacons/${beaconId}/signal-invites`, {
          method: "POST", body: { ttlDays: 30, radiusKm: 100, locale: "pl" },
        }))
        const displayName = typeof upstream.displayName === "string" ? upstream.displayName.trim() : ""
        const inviteUrl = typeof upstream.inviteUrl === "string" ? upstream.inviteUrl.trim() : ""
        const expiresAt = typeof upstream.expiresAt === "string" ? upstream.expiresAt.trim() : ""
        let validInvite = false
        try {
          const parsed = new URL(inviteUrl)
          const invite = parsed.searchParams.getAll("invite")
          validInvite = parsed.protocol === "https:" && parsed.hostname === "virya.music"
            && ["/latarnik", "/latarnik/", "/pl/latarnik", "/pl/latarnik/"].includes(parsed.pathname)
            && parsed.username === "" && parsed.password === "" && parsed.hash === ""
            && [...parsed.searchParams.keys()].every(key => key === "invite")
            && invite.length === 1 && /^[A-Za-z0-9_-]{24,128}$/.test(invite[0] ?? "")
        } catch { /* invalid upstream capability */ }
        if (!displayName || displayName.length > 200 || !validInvite || !Number.isFinite(Date.parse(expiresAt))) {
          throw new StageError(
            `invite response invalid: name=${Boolean(displayName)} url=${validInvite} expires=${Boolean(expiresAt)}`,
            502,
          )
        }
        return areaJson({ beaconId, displayName, inviteUrl, expiresAt }, 201)
      }
      if (action === "preview_invites" || action === "queue_invites") {
        const beaconIds = Array.isArray(record.beaconIds) ? record.beaconIds.filter((value): value is string => typeof value === "string") : []
        const unique = [...new Set(beaconIds)]
        const ttlDays = Number(record.ttlDays ?? 14)
        const radiusKm = Number(record.radiusKm ?? 100)
        const locale = typeof record.locale === "string" ? record.locale : "pl"
        if (unique.length === 0 || unique.length > 200 || unique.length !== beaconIds.length || !unique.every(id => /^[0-9a-f-]{36}$/i.test(id))
          || !Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 30 || !Number.isInteger(radiusKm) || radiusKm < 10 || radiusKm > 500
          || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
          return areaJson({ error: "Invalid invite batch" }, 400)
        }
        return areaJson(await staffApiRequest("admin/autopilot/beacon-network", {
          method: "POST", ...(action === "queue_invites" ? { idempotencyKey } : {}), body: { action, beaconIds: unique, ttlDays, radiusKm, locale },
        }), action === "queue_invites" ? 202 : 200)
      }
      return areaJson({ error: "Unsupported Latarnik network action" }, 400)
    }
    if (record.kind === "beacon_release") {
      const action = typeof record.action === "string" ? record.action : ""
      const campaignId = typeof record.campaignId === "string" ? record.campaignId : ""
      const beaconId = typeof record.beaconId === "string" ? record.beaconId : ""
      const idempotencyKey = forwardedMutationKey(request, mutationPrefix("staff-latarnik", action))
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
    if (error instanceof StageError) {
      return areaJson({ error: error.message }, error.httpStatus)
    }
    // "Could not update campaign" told the operator nothing and told us less.
    // The upstream status separates a rejected payload from a capability that
    // is switched off, and CrowdRelay's problem detail is already sanitised.
    const upstream = error instanceof StaffQrUpstreamError
      ? `CrowdRelay ${error.status}${error.detail ? ` — ${error.detail.slice(0, 160)}` : ""}`
      // Every transport failure already arrives as StaffQrUpstreamError, so this
      // branch is a local fault before the call. Say so instead of blaming the
      // upstream we never reached.
      : `local ${String((error as Error)?.message ?? "unknown").replace(/[^\x20-\x7e]/g, " ").slice(0, 160)}`
    return areaJson({ error: `Could not update campaign (${mutation}: ${upstream})` }, status(error))
  }
}
