import type { APIRoute } from "astro"
import { areaJson } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  try {
    return areaJson(await staffApiRequest("admin/ecosystem/overview", { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Ecosystem control plane unavailable" }, statusFor(error))
  }
}
