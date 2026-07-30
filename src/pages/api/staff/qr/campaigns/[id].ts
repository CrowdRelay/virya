import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffQrRequest } from "../../../../../server/staffQrApi"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }
  const id = params.id ?? ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return areaJson({ error: "Invalid campaign" }, 400)
  }
  try {
    await staffQrRequest<void>(
      `admin/event-qr/campaigns/${encodeURIComponent(id)}/revoke`,
      { method: "POST" },
    )
    return areaJson({ ok: true })
  } catch (error) {
    console.error("[staff-qr-campaign-revoke]", error)
    const status =
      error instanceof StaffQrUpstreamError && [404, 409, 503].includes(error.status)
        ? error.status
        : 502
    return areaJson({ error: "Could not revoke campaign" }, status)
  }
}
