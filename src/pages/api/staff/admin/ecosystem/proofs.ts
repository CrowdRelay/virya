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
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25") || 25))
  const status = url.searchParams.get("status")
  const query = new URLSearchParams({ limit: String(limit) })
  if (status && ["queued", "processing", "confirmed", "failed", "dead"].includes(status)) {
    query.set("status", status)
  }
  try {
    return areaJson(await staffApiRequest(`admin/proofs/batches?${query}`, { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Proof batches unavailable" }, statusFor(error))
  }
}
