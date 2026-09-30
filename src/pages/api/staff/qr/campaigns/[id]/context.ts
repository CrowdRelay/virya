import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffQrRequest } from "../../../../../../server/staffQrApi"

export const prerender = false

const upstreamStatus = (error: unknown) =>
  error instanceof StaffQrUpstreamError && [400, 404, 409, 422, 429, 503].includes(error.status)
    ? error.status
    : 502

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

  let body: unknown
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  try {
    await staffQrRequest<void>(
      `admin/event-qr/campaigns/${encodeURIComponent(id)}/context`,
      { method: "POST", body },
    )
    return areaJson({ ok: true })
  } catch (error) {
    console.error("[staff-qr-campaign-context]", error)
    return areaJson({ error: "Could not update campaign context" }, upstreamStatus(error))
  }
}
