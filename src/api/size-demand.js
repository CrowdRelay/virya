import nodemailer from "nodemailer"
import { getProduct } from "../data/products"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.ORDER_EMAIL_TO || "virya.crew@gmail.com"

  if (!user || !pass) {
    res.status(500).json({ error: "Email not configured." })
    return
  }

  const { id, size } = req.body || {}
  const product = getProduct(id)
  if (!product || !size) {
    res.status(400).json({ error: "Missing product or size." })
    return
  }

  const text = [
    "VIRYA MERCH — SIZE DEMAND",
    "==========================",
    "",
    "Someone tried to buy a sold-out size:",
    "",
    `  Product: ${product.name} (${product.id})`,
    `  Size:    ${size}`,
    "",
    "Consider restocking this size.",
    "",
    "— sent automatically from virya.music/merch",
  ].join("\n")

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: `"Virya Store" <${user}>`,
      to,
      subject: `📈 Restock demand — ${product.name} · ${size}`,
      text,
    })

    res.status(200).json({ sent: true })
  } catch (e) {
    console.error("[size-demand] email failed:", e)
    res.status(500).json({ error: e.message || "Failed to send email." })
  }
}
