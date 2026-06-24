import type { APIRoute } from "astro"
import nodemailer from "nodemailer"

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { name, email, message } = body ?? {}

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 })
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

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error("[contact]", err)
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
  }
}
