import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"

export const prerender = false
const SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const GET: APIRoute = async ({ cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const slug = params.slug ?? ""
  if (!SLUG.test(slug)) return areaJson({ error: "Invalid event" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/ecosystem/checklists/${encodeURIComponent(slug)}`, { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Show checklist unavailable" }, statusFor(error))
  }
}
