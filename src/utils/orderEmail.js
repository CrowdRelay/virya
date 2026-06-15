import nodemailer from "nodemailer"
import { VAT_RATE, vatBreakdown } from "../data/products"

export const sendOrderEmail = async ({ session, lineItems }) => {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.ORDER_EMAIL_TO || user

  if (!user || !pass) {
    console.warn(
      "[orderEmail] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email."
    )
    return { skipped: true }
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
        ).toFixed(2)} ${currency}`
    )
    .join("\n")

  // VAT breakdown for issuing the invoice. Goods carry VAT; delivery is exempt.
  const goodsGross = Number.parseFloat(meta.goods_gross_pln || "0") || 0
  const shipping = Number.parseFloat(meta.shipping_pln || "0") || 0
  const { net, vat } = vatBreakdown(goodsGross)
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
    `  Goods gross: ${f(goodsGross)} ${currency}`,
    `  Delivery:    ${f(shipping)} ${currency} (VAT-exempt)`,
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
    "",
    meta.free_stickers === "yes" ? "  + Free stickers included" : "",
    "",
    "— sent automatically from virya.music/merch",
  ].join("\n")

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
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
  })

  return { sent: true }
}
