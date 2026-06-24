import type { APIRoute } from "astro"
import Stripe from "stripe"
import { getProduct, SHIPPING_PLN, discountedPrice, productRequiresShipping, toMinorUnits, vatBreakdown } from "../../data/products"

const SITE = "https://www.virya.music"

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { lang, items, point, invoice } = body ?? {}

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Empty cart" }), { status: 400 })
    }

    const stripeKey = import.meta.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500 })
    }

    const stripe = new Stripe(stripeKey)
    const ispl = lang === "pl"
    const successPath = ispl ? "/pl/merch/success" : "/merch/success"
    const cancelPath = ispl ? "/pl/merch" : "/merch"

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let goodsGross = 0
    const orderSummaryParts: string[] = []
    let needsShipping = false

    for (const { id, size, qty } of items) {
      const product = getProduct(id)
      if (!product) continue
      const unitPrice = discountedPrice(product)
      const lineTotal = unitPrice * qty
      goodsGross += lineTotal
      if (productRequiresShipping(product)) needsShipping = true

      const productName = (product as any).name
      const label = size ? `${productName} (${size})` : productName
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
      return new Response(JSON.stringify({ error: "No valid items" }), { status: 400 })
    }

    const shippingPln = needsShipping ? SHIPPING_PLN : 0
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
      inv_name: invoice?.name ?? "",
      inv_surname: invoice?.surname ?? "",
      inv_email: invoice?.email ?? "",
      inv_address: invoice?.address ?? "",
      inv_company: invoice?.company ?? "",
      inv_nip: invoice?.nip ?? "",
      paczkomat_code: point?.code ?? "",
      paczkomat_address: point?.address ?? "",
      goods_gross_pln: goodsGross.toFixed(2),
      vat_pln: vat.toFixed(2),
      shipping_pln: shippingPln.toFixed(2),
      order_summary: orderSummaryParts.join(", "),
      free_stickers: "yes",
      lang: lang ?? "en",
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_method_types: ["card", "blik", "revolut_pay", "samsung_pay"],
      success_url: `${SITE}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}${cancelPath}`,
      customer_email: invoice?.email,
      metadata,
    })

    return new Response(JSON.stringify({ url: session.url }), { status: 200 })
  } catch (err) {
    console.error("[checkout]", err)
    const msg = err instanceof Error ? err.message : "Checkout failed"
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
