import type { APIRoute } from "astro"
import nodemailer from "nodemailer"

const MAX_BODY_BYTES = 2048
const MAX_EMAIL_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      return json({ error: "Unsupported content type" }, 415)
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413)
    }

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413)
    }

    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "Invalid request" }, 400)
      }
      body = parsed as Record<string, unknown>
    } catch {
      return json({ error: "Invalid request" }, 400)
    }

    if (typeof body.website === "string" && body.website.trim()) {
      return json({ ok: true })
    }

    const email = typeof body.email === "string" ? body.email.trim() : ""

    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return json({ error: "Invalid request" }, 400)
    }

    const user = import.meta.env.GMAIL_USER
    const pass = import.meta.env.GMAIL_APP_PASSWORD
    const to = import.meta.env.ORDER_EMAIL_TO || user

    if (user && pass) {
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } })
      await transporter.sendMail({
        from: `"Virya Website" <${user}>`,
        to,
        subject: `📬 Newsletter signup — ${email}`,
        text: `New newsletter signup:\n\nEmail: ${email}\n\n— virya.music`,
      })
    } else {
      console.warn("[subscribe] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email.")
    }

    return json({ ok: true })
  } catch (err) {
    console.error("[subscribe]", err)
    return json({ error: "Server error" }, 500)
  }
}
