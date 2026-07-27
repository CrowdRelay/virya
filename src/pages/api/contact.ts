import type { APIRoute } from "astro"
import nodemailer from "nodemailer"

const MAX_BODY_BYTES = 32 * 1024
const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 254
const MAX_MESSAGE_LENGTH = 5000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/

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

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (
      !name ||
      name.length > MAX_NAME_LENGTH ||
      CONTROL_CHAR_PATTERN.test(name) ||
      !email ||
      email.length > MAX_EMAIL_LENGTH ||
      CONTROL_CHAR_PATTERN.test(email) ||
      !EMAIL_PATTERN.test(email) ||
      !message ||
      message.length > MAX_MESSAGE_LENGTH ||
      message.includes("\u0000")
    ) {
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
        replyTo: email,
        subject: `✉️ Message from virya.music — ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      })
    } else {
      console.warn("[contact] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email.")
    }

    return json({ ok: true })
  } catch (err) {
    console.error("[contact]", err)
    return json({ error: "Server error" }, 500)
  }
}
