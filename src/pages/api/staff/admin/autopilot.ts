import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { mutationKeyForRequest } from "../../../../server/mutationSafety"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"

export const prerender = false

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

// One generic string for every upstream status made a stale queue read as a
// broken button: "already approved" and "CrowdRelay is down" looked identical.
// The upstream detail is already captured; only these bounded messages are
// exposed, so nothing from the backend is echoed verbatim to the browser.
const ACTION_FAILURES: Record<number, string> = {
  404: "Tej akcji już nie ma — odśwież kolejkę.",
  409: "Ktoś już podjął tę decyzję albo zgoda wygasła — odśwież kolejkę.",
  422: "Nieprawidłowa akcja.",
  429: "Za dużo prób naraz — spróbuj za chwilę.",
  503: "CrowdRelay chwilowo niedostępny.",
}

const actionFailure = (error: unknown) => {
  const status = statusFor(error)
  return ACTION_FAILURES[status] ?? "Autopilot chwilowo niedostępny."
}

const actionId = (value: unknown): string | null => {
  const id = typeof value === "string" ? value.trim() : ""
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

const memberKey = (value: unknown): string | null => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : ""
  return /^[a-z0-9_-]{2,48}$/.test(key) ? key : null
}

const boundedInteger = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null

const bookingPolicy = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const annualTarget = boundedInteger(input.annual_target, 1, 60)
  const annualStretch = boundedInteger(input.annual_stretch, 1, 60)
  const stretchScore = boundedInteger(input.stretch_minimum_score_basis_points, 0, 10_000)
  const farShotScore = boundedInteger(input.far_shot_minimum_score_basis_points, 0, 10_000)
  const markets = Array.isArray(input.priority_markets)
    ? input.priority_markets.filter((market): market is string => typeof market === "string")
    : []
  if (
    annualTarget === null || annualStretch === null || annualStretch < annualTarget ||
    stretchScore === null || farShotScore === null || typeof input.prefer_weekend_one_shots !== "boolean" ||
    markets.length < 1 || markets.length > 12 || markets.some(market => !/^[A-Z0-9-]{1,24}$/.test(market))
  ) return null
  return {
    annual_target: annualTarget,
    annual_stretch: annualStretch,
    stretch_minimum_score_basis_points: stretchScore,
    prefer_weekend_one_shots: input.prefer_weekend_one_shots,
    priority_markets: [...new Set(markets)],
    far_shot_minimum_score_basis_points: farShotScore,
  }
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const [overviewResult, policyResult] = await Promise.allSettled([
    staffApiRequest<Record<string, unknown>>("admin/autopilot/overview", { timeoutMs: 8_000 }),
    staffApiRequest<Record<string, unknown>>(
      "admin/autopilot/manager-config/booking-policy",
      { timeoutMs: 2_000 },
    ),
  ])
  if (overviewResult.status === "rejected") {
    return areaJson({ error: "Autopilot overview unavailable" }, statusFor(overviewResult.reason))
  }
  const { release_ledger: _technicalReadiness, ...overview } = overviewResult.value
  return areaJson({
    ...overview,
    booking_policy: policyResult.status === "fulfilled" ? policyResult.value : null,
  })
}

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid body" }, 422)
  }

  if (body.operation === "set_booking_policy") {
    const policy = bookingPolicy(body.policy)
    const expectedVersion = boundedInteger(body.expected_version, 0, Number.MAX_SAFE_INTEGER)
    if (!policy || expectedVersion === null) return areaJson({ error: "Invalid booking policy" }, 422)
    try {
      return areaJson(await staffApiRequest("admin/autopilot/manager-config/booking-policy", {
        method: "POST",
        body: {
          policy,
          source: "operator",
          source_revision: "virya-web-control-v1",
          expected_version: expectedVersion,
        },
        idempotencyKey: mutationKeyForRequest(request, "booking-policy", { policy, expectedVersion }),
        timeoutMs: 8_000,
      }))
    } catch (error) {
      return areaJson({ error: "Booking policy update unavailable" }, statusFor(error))
    }
  }

  const id = actionId(body.action_id)
  const operation = body.operation
  if (!id || !["approve", "cancel", "assign"].includes(String(operation))) {
    return areaJson({ error: "Invalid action" }, 422)
  }

  const path = `admin/autopilot/actions/${encodeURIComponent(id)}/${operation}`
  let upstreamBody: Record<string, string> | undefined
  if (operation === "assign") {
    const key = memberKey(body.member_key)
    if (!key) return areaJson({ error: "Invalid member" }, 422)
    upstreamBody = { member_key: key }
  }

  try {
    return areaJson(await staffApiRequest(path, {
      method: "POST",
      body: upstreamBody,
      idempotencyKey: mutationKeyForRequest(request, "autopilot-action", { id, operation, body: upstreamBody ?? null }),
      timeoutMs: 8_000,
    }))
  } catch (error) {
    return areaJson({ error: actionFailure(error) }, statusFor(error))
  }
}
