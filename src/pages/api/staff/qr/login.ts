import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../server/areaHttp"
import {
  consumeStaffQrLoginAttempt,
  getStaffClientNetwork,
  isStaffQrConfigured,
  setStaffQrSession,
  verifyStaffQrPassword,
} from "../../../../server/staffQrAuth"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  if (!isStaffQrConfigured()) {
    return areaJson({ error: "Staff QR is not configured" }, 503)
  }

  let body: unknown
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  try {
    const allowed = await consumeStaffQrLoginAttempt(
      getStaffClientNetwork(request),
    )
    if (!allowed) return areaJson({ error: "Too many attempts" }, 429)
  } catch (error) {
    console.error("[staff-qr-login-rate]", error)
    return areaJson({ error: "Authentication temporarily unavailable" }, 503)
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password?: unknown }).password
      : undefined
  if (!verifyStaffQrPassword(password)) {
    return areaJson({ error: "Invalid credentials" }, 401)
  }

  setStaffQrSession(cookies)
  return areaJson({ ok: true })
}
