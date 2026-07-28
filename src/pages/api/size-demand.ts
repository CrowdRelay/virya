import type { APIRoute } from "astro"
import { getProduct, sizeInStock } from "../../data/products"
import { getSiteMailer } from "../../server/siteMailer"

const MAX_BODY_BYTES = 2048
const MAX_ID_LENGTH = 64
const MAX_SIZE_LENGTH = 16

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

    const id = typeof body.id === "string" ? body.id.trim() : ""
    const size = typeof body.size === "string" ? body.size.trim() : ""
    if (!id || id.length > MAX_ID_LENGTH || !size || size.length > MAX_SIZE_LENGTH) {
      return json({ error: "Invalid request" }, 400)
    }

    const product = getProduct(id)
    if (
      !product ||
      !Array.isArray(product.sizes) ||
      !product.sizes.includes(size) ||
      sizeInStock(product, size)
    ) {
      return json({ error: "Invalid restock request" }, 400)
    }

    const mailer = getSiteMailer()
    if (mailer) {
      const { transporter, user, to } = mailer
      await transporter.sendMail({
        from: `"Virya Store" <${user}>`,
        to,
        subject: `📦 Restock request — ${product.name} / ${size}`,
        text: `Restock demand registered:\n\nProduct: ${product.name} (${id})\nSize: ${size}\n\n— virya.music/merch`,
      })
    }

    return json({ ok: true })
  } catch (err) {
    console.error("[size-demand]", err)
    return json({ error: "Server error" }, 500)
  }
}
