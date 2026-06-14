import nodemailer from "nodemailer"

// Sends the order notification to the band via Gmail SMTP.
// Requires GMAIL_USER + GMAIL_APP_PASSWORD (a Google App Password, not the
// account password). Delivery target defaults to GMAIL_USER.
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

  const text = [
    "NEW VIRYA MERCH ORDER",
    "======================",
    "",
    `Order ref:   ${session.id}`,
    `Paid:        ${session.payment_status}`,
    `Total:       ${total} ${currency}`,
    "",
    "CUSTOMER",
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

  await transporter.sendMail({
    from: `"Virya Store" <${user}>`,
    to,
    replyTo: customer.email || undefined,
    subject: `🛒 New order — ${total} ${currency} — ${
      customer.name || customer.email || session.id
    }`,
    text,
  })

  return { sent: true }
}
