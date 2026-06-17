import nodemailer from "nodemailer"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.CONTACT_EMAIL_TO || "virya.crew@gmail.com"

  const { email } = req.body || {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address." })
    return
  }

  if (!user || !pass) {
    res.status(200).json({ stored: true, notified: false })
    return
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: `"Virya Newsletter" <${user}>`,
      to,
      replyTo: email,
      subject: "📨 New newsletter signup",
      text: [
        "NEW NEWSLETTER SIGNUP",
        "=====================",
        "",
        `Email: ${email}`,
        "",
        "— sent automatically from virya.music",
      ].join("\n"),
    })

    res.status(200).json({ stored: true, notified: true })
  } catch (e) {
    console.error("[subscribe] email failed:", e)
    res.status(200).json({ stored: true, notified: false })
  }
}
