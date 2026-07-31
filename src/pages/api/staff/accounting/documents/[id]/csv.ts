import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiDownload } from "../../../../../../server/staffQrApi"

export const prerender = false
export const GET: APIRoute = async ({ cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id ?? ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return areaJson({ error: "Invalid document" }, 400)
  try {
    const file = await staffApiDownload(`admin/accounting/documents/${encodeURIComponent(id)}/csv`)
    return new Response(file.body, { status: 200, headers: { "Content-Type": file.contentType, "Content-Disposition": file.contentDisposition, "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[staff-accounting-csv]", error)
    const status = error instanceof StaffQrUpstreamError && [404, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: "CSV unavailable" }, status)
  }
}
