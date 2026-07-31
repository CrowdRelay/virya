import { timingSafeEqual } from "node:crypto"
import type { APIRoute } from "astro"
import { qrGifBuffer } from "../../server/ticketQr"
import { getSiteMailer } from "../../server/siteMailer"
import {
  acquireTicketMailLease,
  completeTicketMailLease,
  releaseTicketMailLease,
  type TicketMailLease,
} from "../../server/ticketMailLedger"

export const prerender = false

const MAX_BODY_BYTES = 256 * 1024
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{12,128}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_PATTERN = /^t1\.[A-Za-z0-9_-]+\.[0-9a-f]{64}$/i
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

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left, "utf8")
  const b = Buffer.from(right, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const stringValue = (value: unknown, max = 500) =>
  typeof value === "string" &&
  value.trim() &&
  value.length <= max &&
  !CONTROL_CHAR_PATTERN.test(value)
    ? value.trim()
    : null

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character)

type TicketMail = {
  publicReference: string
  ticketTypeName: string
  sequence: number
  qrToken: string
}

type TicketPayload = {
  eventId: string
  eventType: string
  orderId: string
  orderReference: string
  eventSlug: string
  eventTitle: string
  venue: string | null
  timezone: string
  startsAt: string
  buyerEmail: string
  buyerName: string | null
  locale: "pl" | "en"
  checkoutToken: string
  tickets: TicketMail[]
}

const parsePayload = (raw: unknown): TicketPayload | null => {
  const envelope = asRecord(raw)
  if (!envelope) return null
  const data = asRecord(envelope.data) ?? envelope
  const eventId = stringValue(envelope.id ?? envelope.event_id, 128)
  const eventType = stringValue(envelope.type ?? envelope.event_type, 100)
  const orderId = stringValue(data.order_id, 64)
  const orderReference = stringValue(data.order_reference, 80)
  const eventSlug = stringValue(data.event_slug, 128)
  const eventTitle = stringValue(data.event_title, 300)
  const venue = data.venue == null ? null : stringValue(data.venue, 300)
  const timezone = stringValue(data.timezone, 80) ?? "Europe/Warsaw"
  const startsAt = stringValue(data.starts_at, 64)
  const buyerEmail = stringValue(data.buyer_email, 320)?.toLowerCase()
  const buyerName = data.buyer_name == null ? null : stringValue(data.buyer_name, 200)
  const checkoutToken = stringValue(data.checkout_token, 128)
  const locale = String(data.buyer_locale ?? "en").toLowerCase().startsWith("pl") ? "pl" : "en"
  if (
    !eventId || !EVENT_ID_PATTERN.test(eventId) ||
    !eventType || !["ticket.order.paid", "ticket.order.delivery_requested"].includes(eventType) ||
    !orderId || !orderReference || !eventSlug || !eventTitle || !startsAt ||
    Number.isNaN(Date.parse(startsAt)) || !buyerEmail || !EMAIL_PATTERN.test(buyerEmail) ||
    !checkoutToken || !/^[0-9a-f]{64}$/i.test(checkoutToken) ||
    !Array.isArray(data.tickets) || data.tickets.length < 1 || data.tickets.length > 100
  ) return null

  const tickets: TicketMail[] = []
  for (const item of data.tickets) {
    const ticket = asRecord(item)
    const publicReference = stringValue(ticket?.public_reference, 80)
    const ticketTypeName = stringValue(ticket?.ticket_type_name, 200) ?? (locale === "pl" ? "Bilet" : "Ticket")
    const sequence = Number(ticket?.sequence)
    const qrToken = stringValue(ticket?.qr_token, 2_048)
    if (!publicReference || !Number.isInteger(sequence) || sequence < 1 || !qrToken || !TOKEN_PATTERN.test(qrToken)) return null
    tickets.push({ publicReference, ticketTypeName, sequence, qrToken })
  }

  return {
    eventId,
    eventType,
    orderId,
    orderReference,
    eventSlug,
    eventTitle,
    venue,
    timezone,
    startsAt,
    buyerEmail,
    buyerName,
    locale,
    checkoutToken,
    tickets,
  }
}

const walletUrl = (payload: TicketPayload) => {
  const base = (import.meta.env.PUBLIC_SITE_URL || "https://virya.music").replace(/\/$/, "")
  const prefix = payload.locale === "pl" ? "/pl" : ""
  return `${base}${prefix}/tickets/${encodeURIComponent(payload.orderId)}/#token=${encodeURIComponent(payload.checkoutToken)}`
}

const formatDate = (payload: TicketPayload) =>
  new Intl.DateTimeFormat(payload.locale === "pl" ? "pl-PL" : "en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: payload.timezone,
  }).format(new Date(payload.startsAt))

const sendTickets = async (payload: TicketPayload) => {
  const mailer = getSiteMailer()
  if (!mailer) throw new Error("mailer_not_configured")
  const polish = payload.locale === "pl"
  const url = walletUrl(payload)
  const attachments = payload.tickets.map((ticket, index) => ({
    filename: `Virya-${ticket.publicReference}.gif`,
    content: qrGifBuffer(ticket.qrToken),
    contentType: "image/gif",
    cid: `virya-ticket-${index}@virya.music`,
  }))
  const ticketBlocks = payload.tickets.map((ticket, index) => `
    <div style="margin:22px 0;padding:22px;background:#fff;color:#09090b;text-align:center">
      <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(ticket.ticketTypeName)} // ${ticket.sequence}</p>
      <img src="cid:virya-ticket-${index}@virya.music" width="300" height="300" alt="QR ${escapeHtml(ticket.publicReference)}" style="display:block;max-width:100%;height:auto;margin:0 auto;image-rendering:pixelated" />
      <p style="margin:12px 0 0;font-family:monospace;font-size:12px;font-weight:700">${escapeHtml(ticket.publicReference)}</p>
    </div>`).join("")

  await mailer.transporter.sendMail({
    from: `"Virya Tickets" <${mailer.user}>`,
    to: payload.buyerEmail,
    replyTo: mailer.to,
    subject: polish ? `Twoje bilety: ${payload.eventTitle}` : `Your tickets: ${payload.eventTitle}`,
    text: polish
      ? `Cześć${payload.buyerName ? ` ${payload.buyerName}` : ""}!\n\nTwoje bilety na ${payload.eventTitle} są gotowe.\n${formatDate(payload)}${payload.venue ? ` · ${payload.venue}` : ""}\n\nPrywatny portfel biletów: ${url}\n\nKażdy kod QR jest jednorazowy. Nie publikuj go ani nie przekazuj obcej osobie.\nZamówienie: ${payload.orderReference}`
      : `Hi${payload.buyerName ? ` ${payload.buyerName}` : ""}!\n\nYour tickets for ${payload.eventTitle} are ready.\n${formatDate(payload)}${payload.venue ? ` · ${payload.venue}` : ""}\n\nPrivate ticket wallet: ${url}\n\nEach QR code is single-use. Do not publish it or share it with anyone you do not trust.\nOrder: ${payload.orderReference}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#e4e4e7;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:40px 22px"><p style="color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.18em">VIRYA // TICKETS</p><h1 style="margin:14px 0;color:#fff;font-size:30px;line-height:1.05">${escapeHtml(payload.eventTitle)}</h1><p style="line-height:1.7">${escapeHtml(formatDate(payload))}${payload.venue ? ` · ${escapeHtml(payload.venue)}` : ""}</p>${ticketBlocks}<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#fbbf24;color:#09090b;padding:16px 22px;text-decoration:none;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em">${polish ? "Otwórz portfel biletów" : "Open ticket wallet"}</a></p><p style="color:#a1a1aa;font-size:12px;line-height:1.7">${polish ? "Każdy QR jest jednorazowy. Nie publikuj go w social mediach. Zamówienie:" : "Each QR is single-use. Do not publish it on social media. Order:"} ${escapeHtml(payload.orderReference)}</p></div></body></html>`,
    attachments,
  })
}

export const POST: APIRoute = async ({ request }) => {
  const configuredKey = import.meta.env.VIRYA_TICKET_MAILER_API_KEY?.trim()
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  if (!configuredKey || configuredKey.length < 24 || !safeEqual(provided, configuredKey)) {
    return json({ error: "unauthorized" }, 401)
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json") return json({ error: "unsupported_media_type" }, 415)
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413)

  let parsed: unknown
  try { parsed = JSON.parse(rawBody) as unknown } catch { return json({ error: "invalid_json" }, 400) }
  const payload = parsePayload(parsed)
  if (!payload) return json({ error: "invalid_payload" }, 400)

  let lease: TicketMailLease
  try {
    lease = await acquireTicketMailLease(payload.eventId, payload.eventType, payload.orderId)
  } catch (error) {
    console.error("[ticket-mail-lease]", payload.eventId, payload.orderId, error)
    return new Response(JSON.stringify({ error: "delivery_busy" }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60", "X-Content-Type-Options": "nosniff" } })
  }
  if (lease.status === "done") return json({ ok: true, duplicate: true })
  if (lease.status !== "acquired") return new Response(JSON.stringify({ error: "delivery_busy" }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60", "X-Content-Type-Options": "nosniff" } })

  try {
    await sendTickets(payload)
    await completeTicketMailLease(payload.eventId, lease.leaseId)
    return json({ ok: true })
  } catch (error) {
    try {
      await releaseTicketMailLease(payload.eventId, lease.leaseId)
    } catch (releaseError) {
      console.error("[ticket-mail-release]", payload.eventId, payload.orderId, releaseError)
    }
    console.error("[ticket-mail]", payload.eventId, payload.orderId, error)
    return json({ error: "delivery_failed" }, 503)
  }
}
