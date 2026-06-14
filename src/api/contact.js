import nodemailer from "nodemailer"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.CONTACT_EMAIL_TO || "virya.crew@gmail.com"

  if (!user || !pass) {
    res.status(500).json({ error: "Email not configured." })
    return
  }

  const { name, email, message } = req.body || {}
  if (!name || !email || !message) {
    res.status(400).json({ error: "Missing fields." })
    return
  }

  const text = [
    "NEW virya.music MESSAGE",
    "=======================",
    "",
    `From:     ${name} <${email}>`,
    "",
    "MESSAGE",
    message,
    "",
    "— sent automatically from virya.music",
  ].join("\n")

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: `"Virya Contact" <${user}>`,
      to,
      replyTo: email,
      subject: `✉️ New message from ${name}`,
      text,
    })

    res.status(200).json({ sent: true })
  } catch (e) {
    console.error("[contact] email failed:", e)
    res.status(500).json({ error: e.message || "Failed to send email." })
  }
}
