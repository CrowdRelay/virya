import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"

export const prerender = false

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

const actionId = (value: unknown): string | null => {
  const id = typeof value === "string" ? value.trim() : ""
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

const memberKey = (value: unknown): string | null => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : ""
  return /^[a-z0-9_-]{2,48}$/.test(key) ? key : null
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  try {
    return areaJson(await staffApiRequest("admin/autopilot/overview", { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Autopilot overview unavailable" }, statusFor(error))
  }
}

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: Record<string, unknown>
  try {
    const candidate = await request.json()
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new Error()
    body = candidate as Record<string, unknown>
  } catch {
    return areaJson({ error: "Invalid body" }, 422)
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
      idempotencyKey: crypto.randomUUID(),
      timeoutMs: 8_000,
    }))
  } catch (error) {
    return areaJson({ error: "Autopilot action unavailable" }, statusFor(error))
  }
}
