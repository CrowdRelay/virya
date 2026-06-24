import type { APIRoute } from "astro"
import nodemailer from "nodemailer"

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { email } = body ?? {}

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
        subject: `📬 Newsletter signup — ${email}`,
        text: `New newsletter signup:\n\nEmail: ${email}\n\n— virya.music`,
      })
    } else {
      console.warn("[subscribe] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email.")
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error("[subscribe]", err)
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
  }
}
