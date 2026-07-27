import nodemailer from "nodemailer"
import { VAT_RATE, vatBreakdown } from "../data/products"

export const sendOrderEmail = async ({ session, lineItems }) => {
  const user = import.meta.env.GMAIL_USER
  const pass = import.meta.env.GMAIL_APP_PASSWORD
  const to = import.meta.env.ORDER_EMAIL_TO || user

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD must be configured for order fulfilment.",
    )
  }

  const meta = session.metadata || {}
  const customer = session.customer_details || {}
  const total = (session.amount_total / 100).toFixed(2)
  const currency = (session.currency || "pln").toUpperCase()

  const itemRows = (lineItems || [])
    .map(
      li =>
        `  • ${li.quantity}× ${li.description} — ${(
          li.amount_total / 100
        ).toFixed(2)} ${currency}`,
    )
    .join("\n")

  const goodsGross = Number.parseFloat(meta.goods_gross_pln || "0") || 0
  const shipping = Number.parseFloat(meta.shipping_pln || "0") || 0
  const discount = Math.max(
    0,
    Number(session.total_details?.amount_discount || 0) / 100,
  )
  const isShippingLine = li =>
    String(li.description || "").startsWith("InPost Paczkomat delivery")
  const paidGoodsGross = (lineItems || [])
    .filter(li => !isShippingLine(li))
    .reduce((sum, li) => sum + Number(li.amount_total || 0) / 100, 0)
  const paidShipping = (lineItems || [])
    .filter(isShippingLine)
    .reduce((sum, li) => sum + Number(li.amount_total || 0) / 100, 0)
  // Line item totals are Stripe's post-discount source of truth. Metadata is a
  // fallback for older sessions that do not expose detailed totals.
  const discountedGoodsGross = Math.max(
    0,
    lineItems?.length ? paidGoodsGross : goodsGross - discount,
  )
  const chargedShipping = lineItems?.length ? paidShipping : shipping
  const areaRewardDiscount =
    Number.parseFloat(meta.area_reward_discount_pln || "0") || 0
  const areaRewardShipping =
    Number.parseFloat(meta.area_reward_shipping_pln || "0") || 0
  const { net, vat } = vatBreakdown(discountedGoodsGross)
  const vatPct = Math.round(VAT_RATE * 100)
  const f = n => n.toFixed(2)

  const invoiceLines = [
    "INVOICE DETAILS",
    `  Name:      ${meta.inv_name || "—"} ${meta.inv_surname || ""}`.trimEnd(),
    `  Email:     ${meta.inv_email || "—"}`,
    `  Address:   ${meta.inv_address || "—"}`,
    `  Company:   ${meta.inv_company || "—"}`,
    `  NIP:       ${meta.inv_nip || "— (consumer / no B2B invoice)"}`,
    "",
    "TAX BREAKDOWN",
    `  Goods net:   ${f(net)} ${currency}`,
    `  VAT (${vatPct}%):   ${f(vat)} ${currency}`,
    `  Goods gross: ${f(discountedGoodsGross)} ${currency}`,
    ...(discount > 0 ? [`  Stripe discount: -${f(discount)} ${currency}`] : []),
    ...(areaRewardDiscount > 0
      ? [`  Area free item: -${f(areaRewardDiscount)} ${currency}`]
      : []),
    `  Delivery:    ${f(chargedShipping)} ${currency} (VAT-exempt)`,
    ...(areaRewardShipping > 0
      ? [`  Area free delivery: -${f(areaRewardShipping)} ${currency}`]
      : []),
    `  Grand total: ${total} ${currency}`,
  ]

  const text = [
    "NEW VIRYA MERCH ORDER",
    "======================",
    "",
    `Order ref:   ${session.id}`,
    `Paid:        ${session.payment_status}`,
    `Total:       ${total} ${currency}`,
    "",
    ...invoiceLines,
    "",
    "CUSTOMER (from Stripe)",
    `  Name:      ${customer.name || "—"}`,
    `  Email:     ${customer.email || "—"}`,
    `  Phone:     ${customer.phone || "—"}`,
    "",
    "DELIVERY — InPost Paczkomat",
    `  Locker:    ${meta.paczkomat_code || "—"}`,
    `  Address:   ${meta.paczkomat_address || "—"}`,
    "",
    "ITEMS",
    itemRows || `  ${meta.order_summary || "—"}`,
    ...(meta.area_reward === "free-item-and-shipping"
      ? [
          "",
          "VIRYA AREA REWARD",
          `  Free item: ${meta.area_reward_product_label || "—"}`,
          "  Delivery: free",
        ]
      : []),
    "",
    meta.free_stickers === "yes" ? "  + Free stickers included" : "",
    "",
    "— sent automatically from virya.music/merch",
  ].join("\n")

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })

  const buyerName =
    [meta.inv_name, meta.inv_surname].filter(Boolean).join(" ") ||
    customer.name ||
    meta.inv_email ||
    customer.email ||
    session.id

  await transporter.sendMail({
    from: `"Virya Store" <${user}>`,
    to,
    replyTo: meta.inv_email || customer.email || undefined,
    subject: `🛒 New order — ${total} ${currency} — ${buyerName}`,
    text,
    // A stable Message-ID makes the rare SMTP-accepted / worker-crashed retry
    // recognizable as the same notification instead of a new order.
    messageId: `<virya-order-${session.id}@virya.music>`,
  })

  return { sent: true }
}
