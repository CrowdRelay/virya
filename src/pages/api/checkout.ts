import type { APIRoute } from "astro"
import Stripe from "stripe"
import {
  getProduct,
  SHIPPING_PLN,
  discountedPrice,
  productRequiresShipping,
  toMinorUnits,
  vatBreakdown,
  sizeInStock,
  productInStock,
} from "../../data/products"
import {
  AREA_REWARD_CHECKOUT_SECONDS,
  attachAreaRewardCheckout,
  reserveAreaRewardCode,
} from "../../server/areaReward"
import { mutateAreaWallet } from "../../server/areaLedger"

const MAX_QTY = 20
const MAX_LINES = 50
const MAX_BODY_BYTES = 32 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

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

type CartEntry = {
  id: string
  size: string
  qty: number
  product: any
  unitPrice: number
  label: string
  requiresShipping: boolean
}


const syncRewardWalletReservation = async ({
  ownerId,
  requestId,
  reservationId,
  reservedUntil,
  checkoutSessionId,
  freeProductId,
  freeProductLabel,
}: {
  ownerId: string
  requestId: string
  reservationId: string
  reservedUntil: number
  checkoutSessionId?: string
  freeProductId?: string
  freeProductLabel?: string
}) => {
  try {
    await mutateAreaWallet(ownerId, (wallet) => ({
      wallet: {
        ...wallet,
        vouchers: wallet.vouchers.map((reward) =>
          reward.requestId === requestId && reward.status !== "redeemed"
            ? {
                ...reward,
                status: "reserved" as const,
                reservationId,
                reservedUntil,
                checkoutSessionId:
                  checkoutSessionId ?? reward.checkoutSessionId,
                freeProductId: freeProductId ?? reward.freeProductId,
                freeProductLabel: freeProductLabel ?? reward.freeProductLabel,
              }
            : reward,
        ),
      },
      result: null,
    }))
  } catch (error) {
    // The global reward record is the redemption source of truth. A wallet UI
    // status refresh may lag without weakening the single-use guarantee.
    console.error("[checkout:reward-wallet-sync]", error)
  }
}

const stripeLine = (
  name: string,
  unitPrice: number,
  quantity: number,
): Stripe.Checkout.SessionCreateParams.LineItem => ({
  price_data: {
    currency: "pln",
    product_data: { name },
    unit_amount: toMinorUnits(unitPrice),
  },
  quantity,
})

export const POST: APIRoute = async ({ request }) => {
  try {
    const requestOrigin = new URL(request.url).origin
    const origin = request.headers.get("origin")
    if (origin !== requestOrigin) {
      return json({ error: "Invalid request origin" }, 403)
    }
    let siteOrigin = requestOrigin
    const configuredSite = import.meta.env.SITE_URL?.trim()
    if (configuredSite) {
      try {
        const parsedSite = new URL(configuredSite)
        if (parsedSite.protocol === "https:" || parsedSite.protocol === "http:") {
          siteOrigin = parsedSite.origin
        }
      } catch {
        console.error("[checkout] SITE_URL is invalid; using request origin")
      }
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
    const rewardCode = cleanText(body.rewardCode, 64)
    const checkoutRequestId =
      typeof body.checkoutRequestId === "string"
        ? body.checkoutRequestId.toLowerCase()
        : ""

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > MAX_LINES
    ) {
      return json({ error: "Invalid cart" }, 400)
    }
    if (rewardCode == null) {
      return json({ error: "Invalid VIRYA Area reward code" }, 400)
    }
    if (rewardCode && !UUID_PATTERN.test(checkoutRequestId)) {
      return json({ error: "Invalid reward checkout request" }, 400)
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

    const cart: CartEntry[] = []
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
      if (Array.isArray(product.sizes) && !sizeInStock(product, itemSize)) {
        return json({ error: "Invalid or out-of-stock size" }, 400)
      }

      const productName =
        lang === "pl" && product.name_pl ? product.name_pl : product.name
      const label = itemSize ? `${productName} (${itemSize})` : productName
      cart.push({
        id,
        size: itemSize,
        qty,
        product,
        unitPrice: discountedPrice(product),
        label,
        requiresShipping: productRequiresShipping(product),
      })
    }

    const needsShipping = cart.some((entry) => entry.requiresShipping)
    const pointCode = cleanText(point?.code, 64, needsShipping)
    const pointAddress = cleanText(point?.address, 300, needsShipping)
    if (pointCode == null || pointAddress == null) {
      return json({ error: "Select an InPost Paczkomat" }, 400)
    }

    const stripe = new Stripe(stripeKey)
    const ispl = lang === "pl"
    const successPath = ispl ? "/pl/merch/success" : "/merch/success"
    const cancelPath = ispl ? "/pl/merch" : "/merch"
    const checkoutExpiresAt =
      Math.floor(Date.now() / 1000) + AREA_REWARD_CHECKOUT_SECONDS

    let rewardReservation:
      | Awaited<ReturnType<typeof reserveAreaRewardCode>>
      | null = null
    if (rewardCode) {
      rewardReservation = await reserveAreaRewardCode(
        rewardCode,
        checkoutRequestId,
        checkoutExpiresAt * 1000,
      )
      if (rewardReservation.ok === false) {
        const errors = {
          invalid: "This VIRYA Area code is invalid.",
          expired: "This VIRYA Area code has expired.",
          redeemed: "This VIRYA Area code has already been used.",
          busy: "This VIRYA Area code is attached to another checkout. Try again later.",
          mismatch: "This VIRYA Area code cannot be used for this checkout.",
        }
        return json(
          {
            error: errors[rewardReservation.reason],
            code: `REWARD_${rewardReservation.reason.toUpperCase()}`,
          },
          rewardReservation.reason === "busy" ? 409 : 422,
        )
      }

      await syncRewardWalletReservation({
        ownerId: rewardReservation.record.ownerId,
        requestId: rewardReservation.record.requestId,
        reservationId: checkoutRequestId,
        reservedUntil: checkoutExpiresAt * 1000,
        checkoutSessionId: rewardReservation.record.checkoutSessionId,
        freeProductId: rewardReservation.record.freeProductId,
        freeProductLabel: rewardReservation.record.freeProductLabel,
      })

      if (rewardReservation.record.checkoutSessionId) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(
            rewardReservation.record.checkoutSessionId,
          )
          if (existing.status === "open" && existing.url) {
            return json({ url: existing.url, resumed: true })
          }
        } catch {
          // The deterministic checkout request below safely recreates or
          // recovers the session when Stripe cannot retrieve the old one.
        }
      }
    }

    const freeEntry = rewardCode
      ? cart.reduce((best, entry) =>
          !best || entry.unitPrice > best.unitPrice ? entry : best,
        null as CartEntry | null)
      : null
    if (rewardCode && !freeEntry) {
      return json({ error: "No reward-eligible item in cart" }, 400)
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const orderSummaryParts: string[] = []
    const originalGoodsGross = cart.reduce(
      (sum, entry) => sum + entry.unitPrice * entry.qty,
      0,
    )
    const rewardDiscount = freeEntry?.unitPrice ?? 0
    const goodsGross = Math.max(0, originalGoodsGross - rewardDiscount)

    for (const entry of cart) {
      orderSummaryParts.push(`${entry.qty}× ${entry.label}`)
      if (freeEntry === entry) {
        lineItems.push(
          stripeLine(`${entry.label} — VIRYA Area reward`, 0, 1),
        )
        if (entry.qty > 1) {
          lineItems.push(stripeLine(entry.label, entry.unitPrice, entry.qty - 1))
        }
      } else {
        lineItems.push(stripeLine(entry.label, entry.unitPrice, entry.qty))
      }
    }

    const shippingPln = needsShipping && !rewardCode ? SHIPPING_PLN : 0
    const shippingRewardPln = needsShipping && rewardCode ? SHIPPING_PLN : 0
    if (needsShipping && !rewardCode) {
      lineItems.push(
        stripeLine("InPost Paczkomat delivery", SHIPPING_PLN, 1),
      )
    } else if (needsShipping && rewardCode) {
      lineItems.push(
        stripeLine("InPost Paczkomat delivery — VIRYA Area reward", 0, 1),
      )
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
      goods_original_gross_pln: originalGoodsGross.toFixed(2),
      goods_gross_pln: goodsGross.toFixed(2),
      vat_pln: vat.toFixed(2),
      shipping_pln: shippingPln.toFixed(2),
      order_summary: orderSummaryParts.join(", "),
      free_stickers: "yes",
      lang,
    }

    if (rewardCode && rewardReservation?.ok && freeEntry) {
      metadata.area_reward = "free-item-and-shipping"
      metadata.area_reward_code_hash = rewardReservation.record.codeHash
      metadata.area_reward_reservation_id = checkoutRequestId
      metadata.area_reward_discount_pln = rewardDiscount.toFixed(2)
      metadata.area_reward_shipping_pln = shippingRewardPln.toFixed(2)
      metadata.area_reward_product_id = freeEntry.id
      metadata.area_reward_product_label = freeEntry.label
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      allow_promotion_codes: rewardCode ? false : true,
      success_url: `${siteOrigin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}${cancelPath}`,
      customer_email: invoiceEmail,
      ...(needsShipping ? { phone_number_collection: { enabled: true } } : {}),
      ...(rewardCode ? { expires_at: checkoutExpiresAt } : {}),
      metadata,
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams,
      rewardCode
        ? { idempotencyKey: `area-checkout-${checkoutRequestId}` }
        : undefined,
    )

    if (rewardCode && rewardReservation?.ok && freeEntry) {
      try {
        const attachedReward = await attachAreaRewardCheckout({
          codeHash: rewardReservation.record.codeHash,
          reservationId: checkoutRequestId,
          checkoutSessionId: session.id,
          freeProductId: freeEntry.id,
          freeProductLabel: freeEntry.label,
        })
        await syncRewardWalletReservation({
          ownerId: attachedReward.ownerId,
          requestId: attachedReward.requestId,
          reservationId: checkoutRequestId,
          reservedUntil: checkoutExpiresAt * 1000,
          checkoutSessionId: session.id,
          freeProductId: freeEntry.id,
          freeProductLabel: freeEntry.label,
        })
      } catch (error) {
        try {
          if (session.status === "open") {
            await stripe.checkout.sessions.expire(session.id)
          }
        } catch (expireError) {
          console.error("[checkout:reward-expire]", expireError)
        }
        throw error
      }
    }

    return json({ url: session.url })
  } catch (err) {
    console.error("[checkout]", err)
    return json(
      {
        error: "Checkout temporarily unavailable",
        retrySameRequest: true,
      },
      500,
    )
  }
}
