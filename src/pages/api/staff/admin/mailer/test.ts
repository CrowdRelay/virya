import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJsonObject } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { getSiteMailer } from "../../../../../server/siteMailer"

export const prerender = false
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  let body: Record<string, unknown>
  try { body = await readSmallJsonObject(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  const to = String(body.to ?? "").trim().toLowerCase()
  if (!EMAIL.test(to) || to.length > 320) return areaJson({ error: "Invalid email" }, 400)
  const mailer = getSiteMailer()
  if (!mailer) return areaJson({ error: "Mailer is not configured" }, 503)
  try {
    const result = await mailer.transporter.sendMail({
      from: `Virya <${mailer.user}>`,
      to,
      subject: "Virya Control Center — test mailera",
      text: `Mailer działa poprawnie. Test wykonano ${new Date().toISOString()}.`,
      html: `<div style="font-family:Arial,sans-serif;background:#09090b;color:#e4e4e7;padding:32px"><p style="color:#fbbf24;font-weight:800;letter-spacing:.12em">VIRYA // CONTROL CENTER</p><h1 style="color:#fff">Mailer działa</h1><p>Test wykonano ${new Date().toISOString()}.</p></div>`,
    })
    return areaJson({ ok: true, messageId: result.messageId })
  } catch (error) {
    console.error("[staff-admin-mailer-test]", error)
    return areaJson({ error: "Test email could not be sent" }, 502)
  }
}
