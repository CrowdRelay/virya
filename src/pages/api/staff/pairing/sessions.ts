import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { listStaffDeviceSessions, revokeStaffDeviceSession } from "../../../../server/staffPairing"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  try {
    return areaJson({ sessions: await listStaffDeviceSessions() })
  } catch (error) {
    console.error("[staff-pairing-sessions]", error)
    return areaJson({ error: "Staff sessions temporarily unavailable" }, 503)
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
    await revokeStaffDeviceSession(body.sessionId)
    return areaJson({ revoked: true })
  } catch (error) {
    if (error instanceof TypeError) return areaJson({ error: "Invalid session" }, 422)
    console.error("[staff-pairing-revoke]", error)
    return areaJson({ error: "Session revoke temporarily unavailable" }, 503)
  }
}
