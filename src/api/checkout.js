import Stripe from "stripe"
import {
  CURRENCY,
  SHIPPING_PLN,
  getProduct,
  toMinorUnits,
  productRequiresShipping,
  discountedPrice,
  sizeInStock,
  productInStock,
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
  const { items, point, invoice } = req.body || {}

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Your cart is empty." })
    return
  }

  const name = (invoice?.name || "").trim()
  const surname = (invoice?.surname || "").trim()
  const email = (invoice?.email || "").trim()
  const address = (invoice?.address || "").trim()
  if (!name || !surname || !email || !address) {
    res.status(400).json({ error: "Missing billing details." })
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address." })
    return
  }

  const lineItems = []
  let needsShipping = false
  let goodsGross = 0
  for (const item of items) {
    const product = getProduct(item?.id)
    if (!product) {
      res.status(400).json({ error: `Unknown product: ${item?.id}` })
      return
    }
    if (!productInStock(product)) {
      res.status(400).json({ error: `${product.name} is sold out.` })
      return
    }
    if (productRequiresShipping(product)) needsShipping = true
    const qty = Number.parseInt(item.qty, 10)
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      res.status(400).json({ error: `Invalid quantity for ${product.name}.` })
      return
    }
    let itemName = product.name
    if (Array.isArray(product.sizes)) {
      if (!product.sizes.includes(item.size)) {
        res
          .status(400)
          .json({ error: `Please choose a valid size for ${product.name}.` })
        return
      }
      if (!sizeInStock(product, item.size)) {
        res.status(400).json({
          error: `${product.name} in size ${item.size} is sold out.`,
        })
        return
      }
      itemName = `${product.name} — Size ${item.size}`
    }
    const unitPrice = discountedPrice(product)
    goodsGross += unitPrice * qty
    lineItems.push({
      price_data: {
        currency: CURRENCY,
        unit_amount: toMinorUnits(unitPrice),
        product_data: { name: itemName },
      },
      quantity: qty,
    })
  }

  if (needsShipping) {
    if (!point || !point.code) {
      res.status(400).json({ error: "Please choose an InPost Paczkomat." })
      return
    }
    lineItems.push({
      price_data: {
        currency: CURRENCY,
        unit_amount: toMinorUnits(SHIPPING_PLN),
        product_data: { name: "InPost Paczkomat delivery" },
      },
      quantity: 1,
    })
  }

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
      payment_method_types: ["card", "blik", "revolut_pay"],
      locale: "pl",
      line_items: lineItems,
      customer_email: email,
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      metadata: {
        paczkomat_code: needsShipping && point ? point.code : "",
        paczkomat_address:
          needsShipping && point ? (point.address || "").slice(0, 480) : "",
        order_summary: summary,
        free_stickers: "yes",
        inv_name: name.slice(0, 200),
        inv_surname: surname.slice(0, 200),
        inv_email: email.slice(0, 200),
        inv_address: address.slice(0, 480),
        inv_nip: (invoice?.nip || "").trim().slice(0, 50),
        inv_company: (invoice?.company || "").trim().slice(0, 200),
        goods_gross_pln: String(goodsGross),
        shipping_pln: String(needsShipping ? SHIPPING_PLN : 0),
      },
      success_url: `${siteUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/merch/cancel`,
    })
    res.status(200).json({ url: session.url })
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not start checkout." })
  }
}
