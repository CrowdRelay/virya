import type { APIRoute } from "astro"
import { areaJson } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50))
  try {
    return areaJson(await staffApiRequest(`admin/ecosystem/reconciliation?open_only=true&limit=${limit}`, { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Reconciliation findings unavailable" }, statusFor(error))
  }
}
