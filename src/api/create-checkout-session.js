import Stripe from "stripe"
import {
  CURRENCY,
  SHIPPING_PLN,
  getProduct,
  toMinorUnits,
} from "../data/products"

const MAX_QTY = 20

const resolveSiteUrl = req => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "")
  const host = req.headers["x-forwarded-host"] || req.headers.host
  const proto =
    req.headers["x-forwarded-proto"] ||
    (host && host.includes("localhost") ? "http" : "https")
  return host ? `${proto}://${host}` : "https://www.virya.music"
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "Stripe is not configured." })
    return
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { items, point } = req.body || {}

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Your cart is empty." })
    return
  }
  if (!point || !point.code) {
    res.status(400).json({ error: "Please choose an InPost Paczkomat." })
    return
  }

  // Recompute every line from the trusted catalog — never trust client prices.
  const lineItems = []
  for (const item of items) {
    const product = getProduct(item?.id)
    if (!product) {
      res.status(400).json({ error: `Unknown product: ${item?.id}` })
      return
    }
    const qty = Number.parseInt(item.qty, 10)
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      res.status(400).json({ error: `Invalid quantity for ${product.name}.` })
      return
    }
    let name = product.name
    if (Array.isArray(product.sizes)) {
      if (!product.sizes.includes(item.size)) {
        res
          .status(400)
          .json({ error: `Please choose a valid size for ${product.name}.` })
        return
      }
      name = `${product.name} — Size ${item.size}`
    }
    lineItems.push({
      price_data: {
        currency: CURRENCY,
        unit_amount: toMinorUnits(product.price),
        product_data: { name },
      },
      quantity: qty,
    })
  }

  // InPost delivery as its own line item (reliable in Checkout totals).
  lineItems.push({
    price_data: {
      currency: CURRENCY,
      unit_amount: toMinorUnits(SHIPPING_PLN),
      product_data: { name: "InPost Paczkomat delivery" },
    },
    quantity: 1,
  })

  // Compact, human-readable order summary stored on the session for the
  // confirmation email (Stripe metadata values cap at 500 chars).
  const summary = items
    .map(i => {
      const p = getProduct(i.id)
      return `${i.qty}× ${p ? p.name : i.id}${i.size ? ` (${i.size})` : ""}`
    })
    .join("; ")
    .slice(0, 480)

  const siteUrl = resolveSiteUrl(req)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Google Pay shows automatically alongside "card" once the domain is set up.
      payment_method_types: ["card", "blik", "p24"],
      locale: "pl",
      line_items: lineItems,
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      metadata: {
        paczkomat_code: point.code,
        paczkomat_address: (point.address || "").slice(0, 480),
        order_summary: summary,
        free_stickers: "yes",
      },
      success_url: `${siteUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/merch/cancel`,
    })
    res.status(200).json({ url: session.url })
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not start checkout." })
  }
}
