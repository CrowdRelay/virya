import type { APIRoute } from "astro"
import { getProduct, sizeInStock } from "../../data/products"
import { getSiteMailer } from "../../server/siteMailer"
import { consumePublicFormRateLimit, publicRequestNetwork } from "../../server/publicFormRate"
import { readServerEnv } from "../../server/runtimeEnv"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"

const MAX_BODY_BYTES = 2048
const MAX_ID_LENGTH = 64
const MAX_SIZE_LENGTH = 16

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  })

// Same secret chain the other public forms use; without it the limiter would
// be silently absent.
const rateSecret = () => {
  const dedicated = readServerEnv("CONTACT_RATE_SECRET", import.meta.env.CONTACT_RATE_SECRET)
  if (typeof dedicated === "string" && dedicated.length >= 32) return dedicated
  const existing = readServerEnv("AREA_AUTH_SECRET", import.meta.env.AREA_AUTH_SECRET)
  return typeof existing === "string" && existing.length >= 32 ? existing : null
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const origin = request.headers.get("origin")?.trim().toLowerCase()
    const ownOrigin = new URL(request.url).origin.toLowerCase()
    if (origin && origin !== ownOrigin) return json({ error: "Forbidden origin" }, 403)

    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      return json({ error: "Unsupported content type" }, 415)
    }

    let rawBody: string
    try {
      rawBody = await readLimitedText(request, MAX_BODY_BYTES)
    } catch (error) {
      if (error instanceof BodyTooLargeError) return json({ error: "Request too large" }, 413)
      throw error
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

    // Every mail-sending public form is metered; this one triggers a real
    // SMTP send, so an unbounded loop here is a mail bomb.
    const secret = rateSecret()
    if (!secret) return json({ error: "Restock requests unavailable" }, 503)
    try {
      const allowed = await consumePublicFormRateLimit(
        "size-demand",
        publicRequestNetwork(request),
        secret,
        6,
        60 * 60 * 1_000,
      )
      if (!allowed) return json({ error: "Too many requests" }, 429)
    } catch {
      console.error("[size-demand] rate limiter unavailable")
      return json({ error: "Restock requests unavailable" }, 503)
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
      await mailer.send({
        fromName: "Virya Store",
        to: mailer.to,
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
