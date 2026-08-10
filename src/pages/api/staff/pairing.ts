import type { APIRoute } from "astro"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../server/areaHttp"
import {
  hasStaffQrSession,
  isStaffQrConfigured,
} from "../../../server/staffQrAuth"
import {
  createStaffPairingEnvelope,
  isStaffPairingConfigured,
} from "../../../server/staffPairing"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) =>
  areaJson({
    authenticated: hasStaffQrSession(cookies),
    configured: isStaffQrConfigured() && isStaffPairingConfigured(),
  })

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }
  if (!isStaffPairingConfigured()) {
    return areaJson({ error: "Staff pairing is not configured" }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  try {
    return areaJson(
      await createStaffPairingEnvelope(body.displayName, body.ttlMinutes),
    )
  } catch (error) {
    if (error instanceof TypeError) {
      return areaJson({ error: "Invalid pairing options" }, 422)
    }
    if (error instanceof RangeError) {
      return areaJson({ error: "Pairing payload is too large" }, 503)
    }
    console.error("[staff-pairing]", error)
    return areaJson({ error: "Staff pairing temporarily unavailable" }, 503)
  }
}
