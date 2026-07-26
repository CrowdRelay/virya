import type { APIRoute } from "astro"
import Stripe from "stripe"
import { getProduct, SHIPPING_PLN, discountedPrice, productRequiresShipping, toMinorUnits, vatBreakdown, sizeInStock, productInStock } from "../../data/products"

const SITE = "https://www.virya.music"
const MAX_QTY = 20
const MAX_LINES = 50
const MAX_BODY_BYTES = 32 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })

const cleanText = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string") return required ? null : ""
  const text = value.trim()
  if (
    (required && !text) ||
    text.length > max ||
    CONTROL_CHAR_PATTERN.test(text)
  ) {
    return null
  }
  return text
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const origin = request.headers.get("origin")
    if (origin !== new URL(request.url).origin) {
      return json({ error: "Invalid request origin" }, 403)
    }

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

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json({ error: "Invalid request" }, 400)
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request" }, 400)
    }
    const { lang: rawLang, items, point, invoice } = body
    const lang = rawLang === "pl" ? "pl" : "en"

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > MAX_LINES
    ) {
      return json({ error: "Invalid cart" }, 400)
    }

    const stripeKey = import.meta.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return json({ error: "Checkout temporarily unavailable" }, 503)
    }

    const invoiceName = cleanText(invoice?.name, 100, true)
    const invoiceSurname = cleanText(invoice?.surname, 100, true)
    const invoiceEmail = cleanText(invoice?.email, 254, true)
    const invoiceAddress = cleanText(invoice?.address, 300, true)
    const invoiceCompany = cleanText(invoice?.company, 200)
    const invoiceNip = cleanText(invoice?.nip, 32)
    if (
      invoiceName == null ||
      invoiceSurname == null ||
      invoiceEmail == null ||
      !EMAIL_PATTERN.test(invoiceEmail) ||
      invoiceAddress == null ||
      invoiceCompany == null ||
      invoiceNip == null
    ) {
      return json({ error: "Invalid customer details" }, 400)
    }

    const stripe = new Stripe(stripeKey)
    const ispl = lang === "pl"
    const successPath = ispl ? "/pl/merch/success" : "/merch/success"
    const cancelPath = ispl ? "/pl/merch" : "/merch"

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let goodsGross = 0
    const orderSummaryParts: string[] = []
    let needsShipping = false

    let totalQuantity = 0
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return json({ error: "Invalid cart item" }, 400)
      }
      const { id, size, qty: rawQty } = item
      if (typeof id !== "string" || id.length > 64) {
        return json({ error: "Invalid cart item" }, 400)
      }
      const product = getProduct(id)
      if (!product) {
        return json({ error: "Invalid cart item" }, 400)
      }

      const qty = Number(rawQty)
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return json({ error: "Invalid quantity" }, 400)
      }
      const itemSize = size == null ? "" : cleanText(size, 16)
      if (itemSize == null) {
        return json({ error: "Invalid size" }, 400)
      }
      totalQuantity += qty
      if (totalQuantity > MAX_LINES) {
        return json({ error: "Order is too large" }, 400)
      }
      if (!productInStock(product)) {
        return json({ error: `Out of stock: ${(product as any).name}` }, 400)
      }
      if (
        Array.isArray((product as any).sizes) &&
        !sizeInStock(product, itemSize)
      ) {
        return json({ error: "Invalid or out-of-stock size" }, 400)
      }

      const unitPrice = discountedPrice(product)
      const lineTotal = unitPrice * qty
      goodsGross += lineTotal
      if (productRequiresShipping(product)) needsShipping = true

      const productName = (product as any).name
      const label = itemSize ? `${productName} (${itemSize})` : productName
      orderSummaryParts.push(`${qty}× ${label}`)

      lineItems.push({
        price_data: {
          currency: "pln",
          product_data: { name: label },
          unit_amount: toMinorUnits(unitPrice),
        },
        quantity: qty,
      })
    }

    if (lineItems.length === 0) {
      return json({ error: "No valid items" }, 400)
    }

    const shippingPln = needsShipping ? SHIPPING_PLN : 0
    const pointCode = cleanText(point?.code, 64, needsShipping)
    const pointAddress = cleanText(point?.address, 300, needsShipping)
    if (pointCode == null || pointAddress == null) {
      return json({ error: "Select an InPost Paczkomat" }, 400)
    }

    if (needsShipping) {
      lineItems.push({
        price_data: {
          currency: "pln",
          product_data: { name: "InPost Paczkomat delivery" },
          unit_amount: toMinorUnits(SHIPPING_PLN),
        },
        quantity: 1,
      })
    }

    const { vat } = vatBreakdown(goodsGross)

    const metadata: Record<string, string> = {
      inv_name: invoiceName,
      inv_surname: invoiceSurname,
      inv_email: invoiceEmail,
      inv_address: invoiceAddress,
      inv_company: invoiceCompany,
      inv_nip: invoiceNip,
      paczkomat_code: pointCode,
      paczkomat_address: pointAddress,
      goods_gross_pln: goodsGross.toFixed(2),
      vat_pln: vat.toFixed(2),
      shipping_pln: shippingPln.toFixed(2),
      order_summary: orderSummaryParts.join(", "),
      free_stickers: "yes",
      lang,
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      allow_promotion_codes: true,
      // payment_method_types: ["card", "blik", "revolut_pay"],
      success_url: `${SITE}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}${cancelPath}`,
      customer_email: invoiceEmail,
      metadata,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error("[checkout]", err)
    return json({ error: "Checkout temporarily unavailable" }, 500)
  }
}
