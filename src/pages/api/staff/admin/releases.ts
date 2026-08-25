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

const FAILURE_MESSAGES: Record<number, string> = {
  400: "Nieprawidłowe dane wydania.",
  404: "Ten obiekt już nie istnieje — odśwież widok.",
  409: "Ktoś zaktualizował ten plan przed Tobą — odśwież i wprowadź zmiany ponownie.",
  422: "Nieprawidłowe dane.",
  429: "Za dużo prób naraz — spróbuj za chwilę.",
  503: "CrowdRelay chwilowo niedostępny.",
}

const failure = (error: unknown) => {
  const status = statusFor(error)
  return { message: FAILURE_MESSAGES[status] ?? "Wydania chwilowo niedostępne.", status }
}

const boundedText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

const boundedUrl = (value: unknown): string | null => {
  const raw = boundedText(value, 1000)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

const boundedDateTime = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const boundedFlag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

const boundedVersion = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
    ? value
    : 0

const actionUuid = (value: unknown): string | null => {
  const id = typeof value === "string" ? value.trim() : ""
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const [plansResult, wavesResult] = await Promise.allSettled([
    staffApiRequest<unknown[]>("admin/autopilot/releases", { timeoutMs: 8_000 }),
    staffApiRequest<unknown[]>("admin/autopilot/outreach-waves", { timeoutMs: 8_000 }),
  ])
  return areaJson({
    plans: plansResult.status === "fulfilled" && Array.isArray(plansResult.value) ? plansResult.value : [],
    waves: wavesResult.status === "fulfilled" && Array.isArray(wavesResult.value) ? wavesResult.value : [],
    degraded: plansResult.status === "rejected" || wavesResult.status === "rejected",
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

  if (body.operation === "approve_wave") {
    const waveId = actionUuid(body.wave_id)
    if (!waveId) return areaJson({ error: "Invalid wave" }, 422)
    try {
      return areaJson(await staffApiRequest(
        `admin/autopilot/outreach-waves/${encodeURIComponent(waveId)}/approve`,
        {
          method: "POST",
          idempotencyKey: mutationKeyForRequest(request, "outreach-wave", { waveId }),
          timeoutMs: 8_000,
        },
      ))
    } catch (error) {
      return areaJson({ error: failure(error).message }, statusFor(error))
    }
  }

  const title = boundedText(body.title, 240)
  const releaseAt = boundedDateTime(body.release_at)
  if (!title || !releaseAt) return areaJson({ error: "Invalid body" }, 422)

  const sourceKey = boundedText(body.source_key, 160) ?? `staff-panel:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`
  const listenUrl = body.listen_url === undefined || body.listen_url === null ? undefined : boundedUrl(body.listen_url)
  if (body.listen_url !== undefined && body.listen_url !== null && !listenUrl) {
    return areaJson({ error: "Invalid listen url" }, 422)
  }
  const releaseId = actionUuid(body.release_id)
  const payload = {
    source_key: sourceKey,
    title,
    release_at: releaseAt,
    listen_url: listenUrl ?? undefined,
    active: boundedFlag(body.active, true),
    assets_ready: boundedFlag(body.assets_ready, false),
    communication_enabled: boundedFlag(body.communication_enabled, true),
    press_enabled: boundedFlag(body.press_enabled, false),
    expected_version: boundedVersion(body.expected_version),
    ...(releaseId ? { release_id: releaseId } : {}),
  }
  try {
    return areaJson(await staffApiRequest("admin/autopilot/releases", {
      method: "POST",
      body: payload,
      idempotencyKey: mutationKeyForRequest(request, "release-plan", { ...payload }),
      timeoutMs: 8_000,
    }))
  } catch (error) {
    return areaJson({ error: failure(error).message }, statusFor(error))
  }
}
