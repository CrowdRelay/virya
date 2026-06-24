import type { APIRoute } from "astro"
import nodemailer from "nodemailer"
import { getProduct } from "../../data/products"

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { id, size } = body ?? {}

    if (!id || !size) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 })
    }

    const product = getProduct(id)
    if (!product) {
      return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 })
    }

    const user = import.meta.env.GMAIL_USER
    const pass = import.meta.env.GMAIL_APP_PASSWORD
    const to = import.meta.env.ORDER_EMAIL_TO || user

    if (user && pass) {
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } })
      await transporter.sendMail({
        from: `"Virya Store" <${user}>`,
        to,
        subject: `📦 Restock request — ${product.name} / ${size}`,
        text: `Restock demand registered:\n\nProduct: ${product.name} (${id})\nSize: ${size}\n\n— virya.music/merch`,
      })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error("[size-demand]", err)
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
  }
}
