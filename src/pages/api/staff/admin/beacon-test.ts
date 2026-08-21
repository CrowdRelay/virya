import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { mutationKeyForRequest } from "../../../../server/mutationSafety"
import { BodyTooLargeError, readLimitedText } from "../../../../server/readLimitedBody"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"

export const prerender = false

// Beacons normally arrive through discovery and a consent review, which is the
// right gate for strangers and the wrong one for putting our own people on the
// network to exercise it. This mints a single verified beacon plus its invite
// so staff can hold a real Beacon session on web and mobile.

const MAX_BODY_BYTES = 8 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS = new Set([
  "radio", "local_press", "television", "reviewer", "creator", "photographer",
  "promoter", "venue", "scene_partner", "patron", "community",
])
const CONTROL = /[\u0000-\u001f\u007f]/

const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null
  const result = value.trim()
  return !result || result.length > max || CONTROL.test(result) ? null : result
}

const upstreamStatus = (error: unknown) =>
  error instanceof StaffQrUpstreamError &&
  [400, 401, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

const beaconIdOf = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const nested = record.beacon
  for (const candidate of [
    record.beaconId,
    record.beacon_id,
    record.id,
    nested && typeof nested === "object"
      ? (nested as Record<string, unknown>).id
      : undefined,
  ]) {
    if (typeof candidate === "string" && UUID.test(candidate)) return candidate
  }
  return null
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)

  let raw: string
  try {
    raw = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return areaJson({ error: "Request too large" }, 413)
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const body = parsed as Record<string, unknown>

  const displayName = text(body.displayName, 240)
  const contactEmail = text(body.contactEmail, 320)
  const beaconKind = text(body.beaconKind, 40) ?? "promoter"
  const cityId = body.cityId == null || body.cityId === "" ? null : text(body.cityId, 64)
  const ttlDays = Number.isInteger(body.ttlDays) ? (body.ttlDays as number) : 30
  const radiusKm = Number.isInteger(body.radiusKm) ? (body.radiusKm as number) : 100
  const locale = body.locale === "en" ? "en" : "pl"

  if (
    !displayName ||
    !contactEmail ||
    !contactEmail.includes("@") ||
    !KINDS.has(beaconKind) ||
    (cityId !== null && !UUID.test(cityId)) ||
    ttlDays < 1 || ttlDays > 30 ||
    radiusKm < 10 || radiusKm > 500
  ) {
    return areaJson({ error: "Invalid beacon" }, 400)
  }

  let beaconId: string | null
  try {
    const created = await staffApiRequest("admin/autopilot/beacons", {
      method: "POST",
      body: {
        beacon_id: null,
        city_id: cityId,
        beacon_kind: beaconKind,
        display_name: displayName,
        contact_email: contactEmail,
        destination_url: null,
        source_url: null,
        active: true,
        // Staff-minted, so identity is known and outreach is self-consented.
        verified: true,
        accepts_outreach: true,
        do_not_contact: false,
        relationship_score: 100,
        relevance_basis_points: 10_000,
        confidence_basis_points: 10_000,
        metadata: { origin: "staff_test_beacon" },
        expected_version: 0,
      },
      idempotencyKey: mutationKeyForRequest(request, "staff-beacon-test", contactEmail),
      timeoutMs: 15_000,
    })
    beaconId = beaconIdOf(created)
  } catch (error) {
    console.error("[staff-beacon-test-create]", error)
    return areaJson({ error: "Beacon could not be created" }, upstreamStatus(error))
  }

  if (!beaconId) {
    return areaJson({ error: "Beacon created without a usable id" }, 502)
  }

  try {
    const invite = await staffApiRequest(
      `admin/autopilot/beacons/${encodeURIComponent(beaconId)}/signal-invites`,
      {
        method: "POST",
        body: { ttl_days: ttlDays, radius_km: radiusKm, locale },
        idempotencyKey: mutationKeyForRequest(request, "staff-beacon-invite", beaconId),
        timeoutMs: 15_000,
      },
    )
    return areaJson({ beaconId, invite })
  } catch (error) {
    console.error("[staff-beacon-test-invite]", error)
    return areaJson({ error: "Invite could not be minted", beaconId }, upstreamStatus(error))
  }
}
