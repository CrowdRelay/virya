import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../server/staffQrApi"

export const prerender = false
export const GET: APIRoute = async ({ cookies, url }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const month = url.searchParams.get("month") ?? ""
  const currency = url.searchParams.get("currency") ?? "PLN"
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[A-Z]{3}$/.test(currency)) return areaJson({ error: "Invalid period" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/accounting/invoice-requests?month=${encodeURIComponent(month)}&currency=${currency}`))
  } catch (error) {
    console.error("[staff-accounting-invoices]", error)
    const status = error instanceof StaffQrUpstreamError && [400, 404, 503].includes(error.status) ? error.status : 502
    return areaJson({ error: "Invoice requests unavailable" }, status)
  }
}
