import { readServerEnv } from "../../server/runtimeEnv.ts"
import { timingSafeEqual } from "node:crypto"
import type { APIRoute } from "astro"
import { qrGifBuffer } from "../../server/ticketQr"
import {
  acquireCrowdRelayMailLease,
  completeCrowdRelayMailLease,
  markCrowdRelayMailAmbiguous,
  type CrowdRelayMailLease,
} from "../../server/crowdrelayMailLedger"
import { getSiteMailer } from "../../server/siteMailer"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"

export const prerender = false

const MAX_BODY_BYTES = 64 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_.:-]{12,200}$/

const TEMPLATES = new Set([
  "crowdrelay-confirm-email",
  "crowdrelay-fan-welcome",
  "crowdrelay-event-reminder",
  "crowdrelay-new-gig",
  "crowdrelay-event-change",
  "crowdrelay-merch-reward",
  "crowdrelay-ticket-reward",
  "crowdrelay-admission-winner",
  "crowdrelay-admission-redeemed",
])

type Variables = Record<string, unknown>
type MailPayload = {
  template: string
  to: string | null
  variables: Variables
  idempotencyKey: string
  operation: "mail" | "event"
}

type RenderedMail = {
  subject: string
  text: string
  html: string
  attachments?: readonly {
    filename: string
    content: Uint8Array
    contentType: string
    cid: string
  }[]
}

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

const asRecord = (value: unknown): Variables | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Variables)
    : null

const valueString = (value: unknown, max = 2_000) =>
  typeof value === "string" &&
  value.trim() &&
  value.length <= max &&
  !CONTROL_CHAR_PATTERN.test(value)
    ? value.trim()
    : null

const optionalString = (value: unknown, max = 2_000) =>
  value == null || value === "" ? null : valueString(value, max)

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  )

const safeUrl = (value: unknown) => {
  const raw = valueString(value, 4_096)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const polish = (variables: Variables) =>
  String(variables.locale ?? "pl").toLowerCase().startsWith("pl")

const displayName = (variables: Variables) =>
  optionalString(variables.display_name, 200)

const greeting = (variables: Variables) => {
  const name = displayName(variables)
  return polish(variables)
    ? name
      ? `Cześć ${name}!`
      : "Cześć!"
    : name
      ? `Hi ${name}!`
      : "Hi!"
}

const formatDate = (value: unknown, isPolish: boolean) => {
  const raw = valueString(value, 64)
  if (!raw || Number.isNaN(Date.parse(raw))) return raw
  try {
    return new Intl.DateTimeFormat(isPolish ? "pl-PL" : "en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Warsaw",
    }).format(new Date(raw))
  } catch {
    return raw
  }
}

const layout = ({
  eyebrow,
  title,
  body,
  button,
  buttonUrl,
  footer,
}: {
  eyebrow: string
  title: string
  body: string
  button?: string | null
  buttonUrl?: string | null
  footer?: string | null
}) => {
  const cta = button && buttonUrl
    ? `<p style="margin:30px 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#84b4ac;color:#09090b;padding:16px 22px;text-decoration:none;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em">${escapeHtml(button)}</a></p>`
    : ""
  const footerBlock = footer
    ? `<p style="margin-top:34px;color:#71717a;font-size:12px;line-height:1.7">${footer}</p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#09090b;color:#e4e4e7;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:40px 22px"><p style="color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.18em">${escapeHtml(eyebrow)}</p><h1 style="margin:14px 0;color:#fff;font-size:30px;line-height:1.05">${escapeHtml(title)}</h1><div style="line-height:1.75">${body}</div>${cta}${footerBlock}</div></body></html>`
}

const paragraph = (value: string) => `<p>${escapeHtml(value)}</p>`
const linkLine = (label: string, url: string) =>
  `<p>${escapeHtml(label)}:<br><a style="color:#fbbf24" href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`

type TicketPromoEvent = {
  title: string
  startsAt: string
  location: string | null
  ticketUrl: string
}

const ticketPromoEvents = (value: unknown, isPolish: boolean): TicketPromoEvent[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null
  const events: TicketPromoEvent[] = []
  for (const candidate of value) {
    const event = asRecord(candidate)
    const title = valueString(event?.title ?? event?.event_title, 300)
    const startsAtRaw = valueString(event?.starts_at, 64)
    const ticketUrl = safeUrl(event?.ticket_url ?? event?.event_url)
    const venue = optionalString(event?.venue, 300)
    const city = optionalString(event?.city, 200)
    if (!title || !startsAtRaw || Number.isNaN(Date.parse(startsAtRaw)) || !ticketUrl) return null
    events.push({
      title,
      startsAt: formatDate(startsAtRaw, isPolish) ?? startsAtRaw,
      location: [venue, city].filter(Boolean).join(" · ") || null,
      ticketUrl,
    })
  }
  return events
}

const render = async (template: string, variables: Variables): Promise<RenderedMail | null> => {
  const isPolish = polish(variables)
  const hello = greeting(variables)

  if (template === "crowdrelay-confirm-email") {
    const url = safeUrl(variables.confirmation_url)
    if (!url) return null
    const sessionRecovery = variables.purpose === "session_recovery"
    const subject = sessionRecovery
      ? isPolish
        ? "Odzyskaj dostęp — Virya Signal"
        : "Restore access — Virya Signal"
      : isPolish
        ? "Potwierdź adres e-mail — Virya Signal"
        : "Confirm your email — Virya Signal"
    const title = sessionRecovery
      ? isPolish
        ? "Odzyskaj dostęp do Sygnału"
        : "Restore access to Signal"
      : isPolish
        ? "Potwierdź adres e-mail"
        : "Confirm your email"
    const copy = sessionRecovery
      ? isPolish
        ? "Otrzymujesz tę wiadomość, ponieważ poproszono o bezpieczny link dostępu do aktywnego profilu Virya Signal. Jeśli to nie Ty, zignoruj wiadomość."
        : "You received this message because a secure access link was requested for an active Virya Signal profile. If this was not you, ignore this email."
      : isPolish
        ? "Otrzymujesz tę wiadomość, ponieważ rozpoczęto zapis do Virya Signal. Kliknij przycisk poniżej, aby potwierdzić adres. Jeśli to nie Ty, zignoruj wiadomość."
        : "You received this message because a Virya Signal signup was started. Use the button below to confirm the address. If this was not you, ignore this email."
    const button = sessionRecovery
      ? isPolish ? "Otwórz mój Sygnał" : "Open my Signal"
      : isPolish ? "Potwierdź adres" : "Confirm address"
    const footerLabel = sessionRecovery
      ? isPolish ? "Bezpieczny adres dostępu" : "Secure access address"
      : isPolish ? "Adres potwierdzenia" : "Confirmation address"
    const qrPayload = valueString(variables.confirmation_qr_payload, 4_096)
    let qrBlock = ""
    let attachments: RenderedMail["attachments"]
    if (qrPayload) {
      const qrGif = qrGifBuffer(qrPayload)
      const qrLabel = isPolish
        ? "Zeskanuj w aplikacji Virya Signal"
        : "Scan in the Virya Signal app"
      qrBlock = `<div style="margin:28px 0;padding:20px;background:#fff;text-align:center"><p style="margin:0 0 14px;color:#09090b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(qrLabel)}</p><img src="cid:virya-signal-confirmation-qr" width="240" height="240" alt="${escapeHtml(qrLabel)}" style="display:block;margin:auto;width:240px;height:240px" /></div>`
      attachments = [{
        filename: "virya-signal-access.gif",
        content: qrGif,
        contentType: "image/gif",
        cid: "virya-signal-confirmation-qr",
      }]
    }
    return {
      subject,
      text: `${hello}\n\n${copy}\n\n${url}`,
      html: layout({
        eyebrow: isPolish ? "VIRYA // SYGNAŁ" : "VIRYA // SIGNAL",
        title,
        body: paragraph(hello) + paragraph(copy) + qrBlock,
        button,
        buttonUrl: url,
        footer: `${footerLabel}:<br>${escapeHtml(url)}`,
      }),
      attachments,
    }
  }

  if (template === "crowdrelay-fan-welcome") {
    const referralUrl = safeUrl(variables.referral_url)
    if (!referralUrl) return null
    const accountUrl = safeUrl(variables.my_signal_url)
    const unsubscribeUrl = safeUrl(variables.unsubscribe_url)
    const subject = isPolish
      ? "Twój Sygnał Virya jest aktywny"
      : "Your Virya Signal is active"
    const copy = isPolish
      ? "Twój Sygnał działa. Od teraz koncerty, nagrody i polecenia mogą pracować jako jeden system."
      : "Your Signal is active. Shows, rewards and referrals can now work as one system."
    const lines = [hello, copy, `${isPolish ? "Link polecający" : "Referral link"}: ${referralUrl}`]
    if (accountUrl) lines.push(`${isPolish ? "Mój Sygnał" : "My Signal"}: ${accountUrl}`)
    if (unsubscribeUrl) lines.push(`${isPolish ? "Wypisz się" : "Unsubscribe"}: ${unsubscribeUrl}`)
    return {
      subject,
      text: lines.join("\n\n"),
      html: layout({
        eyebrow: isPolish ? "VIRYA // SYGNAŁ" : "VIRYA // SIGNAL",
        title: isPolish ? "Sygnał aktywny" : "Signal active",
        body:
          paragraph(hello) +
          paragraph(copy) +
          linkLine(isPolish ? "Twój link polecający" : "Your referral link", referralUrl),
        button: accountUrl ? (isPolish ? "Otwórz Mój Sygnał" : "Open My Signal") : null,
        buttonUrl: accountUrl,
        footer: unsubscribeUrl
          ? `<a style="color:#71717a" href="${escapeHtml(unsubscribeUrl)}">${isPolish ? "Wypisz mnie" : "Unsubscribe"}</a>`
          : null,
      }),
    }
  }

  if (template === "crowdrelay-event-reminder") {
    const title = valueString(variables.event_title, 300)
    const startsAt = formatDate(variables.starts_at, isPolish)
    const eventUrl = safeUrl(variables.event_url)
    if (!title || !startsAt || !eventUrl) return null
    const venue = optionalString(variables.venue, 300)
    const address = optionalString(variables.venue_address, 500)
    const ticketUrl = safeUrl(variables.ticket_url) ?? eventUrl
    const details = [startsAt, venue, address].filter(Boolean).join(" · ")
    return {
      subject: isPolish ? `Przypomnienie: ${title}` : `Reminder: ${title}`,
      text: `${hello}\n\n${isPolish ? "Zbliża się koncert" : "The show is coming up"}: ${title}\n${details}\n\n${eventUrl}`,
      html: layout({
        eyebrow: "VIRYA // LIVE",
        title,
        body: paragraph(hello) + paragraph(details),
        button: isPolish ? "Zobacz koncert" : "View show",
        buttonUrl: eventUrl,
        footer: `${isPolish ? "Bilety" : "Tickets"}: <a style="color:#fbbf24" href="${escapeHtml(ticketUrl)}">${escapeHtml(ticketUrl)}</a>`,
      }),
    }
  }

  if (template === "crowdrelay-new-gig") {
    const title = valueString(variables.event_title, 300)
    const startsAt = formatDate(variables.starts_at, isPolish)
    const eventUrl = safeUrl(variables.event_url)
    if (!title || !startsAt || !eventUrl) return null
    const venue = optionalString(variables.venue, 300)
    const city = optionalString(variables.city, 200)
    const description = optionalString(variables.event_description, 2_000)
    const rsvpUrl = safeUrl(variables.rsvp_url)
    const followUrl = safeUrl(variables.follow_url)
    const details = [startsAt, venue, city].filter(Boolean).join(" · ")
    const body =
      paragraph(hello) +
      paragraph(isPolish ? "Mamy nowy koncert." : "We have a new show.") +
      paragraph(details) +
      (description ? paragraph(description) : "")
    const links = [
      rsvpUrl ? linkLine(isPolish ? "Zaznacz obecność" : "RSVP", rsvpUrl) : "",
      followUrl ? linkLine(isPolish ? "Obserwuj Viryę" : "Follow Virya", followUrl) : "",
    ].join("")
    return {
      subject: isPolish ? `Nowy koncert Viryi: ${title}` : `New Virya show: ${title}`,
      text: `${hello}\n\n${isPolish ? "Mamy nowy koncert" : "We have a new show"}: ${title}\n${details}\n\n${eventUrl}${rsvpUrl ? `\nRSVP: ${rsvpUrl}` : ""}${followUrl ? `\nFollow: ${followUrl}` : ""}`,
      html: layout({
        eyebrow: "VIRYA // NEW LIVE SIGNAL",
        title,
        body: body + links,
        button: isPolish ? "Zobacz wydarzenie" : "View event",
        buttonUrl: eventUrl,
      }),
    }
  }

  if (template === "crowdrelay-event-change") {
    const title = valueString(variables.event_title, 300)
    const kind = valueString(variables.change_kind, 32)
    const eventUrl = safeUrl(variables.event_url)
    if (!title || !eventUrl || (kind !== "updated" && kind !== "cancelled")) return null
    const startsAt = formatDate(variables.starts_at, isPolish)
    const venue = optionalString(variables.venue, 300)
    const previousStartsAt = formatDate(variables.previous_starts_at, isPolish)
    const previousVenue = optionalString(variables.previous_venue, 300)
    const cancelled = kind === "cancelled"
    const heading = cancelled
      ? isPolish ? "Koncert odwołany" : "Show cancelled"
      : isPolish ? "Zmiana dotycząca koncertu" : "Show update"
    const current = [startsAt, venue].filter(Boolean).join(" · ")
    const previous = [previousStartsAt, previousVenue].filter(Boolean).join(" · ")
    return {
      subject: `${heading}: ${title}`,
      text: `${hello}\n\n${heading}: ${title}\n${previous ? `${isPolish ? "Poprzednio" : "Previously"}: ${previous}\n` : ""}${current ? `${isPolish ? "Teraz" : "Now"}: ${current}\n` : ""}\n${eventUrl}`,
      html: layout({
        eyebrow: "VIRYA // LIVE UPDATE",
        title: `${heading}: ${title}`,
        body:
          paragraph(hello) +
          (previous ? paragraph(`${isPolish ? "Poprzednio" : "Previously"}: ${previous}`) : "") +
          (current ? paragraph(`${isPolish ? "Teraz" : "Now"}: ${current}`) : ""),
        button: isPolish ? "Sprawdź szczegóły" : "Check details",
        buttonUrl: eventUrl,
      }),
    }
  }

  if (template === "crowdrelay-ticket-reward") {
    const code = valueString(variables.coupon_code, 100)
    const discount = Number(variables.discount_percent)
    const expiresAt = formatDate(variables.expires_at, isPolish)
    const events = ticketPromoEvents(
      variables.upcoming_events ?? variables.events,
      isPolish,
    )
    if (
      !code ||
      !Number.isFinite(discount) ||
      discount <= 0 ||
      discount > 100 ||
      !expiresAt ||
      !events
    ) return null

    const nearest = events[0]
    const textEvents = events
      .map(event => `• ${event.title} — ${event.startsAt}${event.location ? ` · ${event.location}` : ""}\n  ${event.ticketUrl}`)
      .join("\n")
    const htmlEvents = events
      .map(event => `<li style="margin:0 0 16px"><strong style="color:#fff">${escapeHtml(event.title)}</strong><br><span style="color:#a1a1aa">${escapeHtml(event.startsAt)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</span><br><a style="color:#fbbf24" href="${escapeHtml(event.ticketUrl)}">${isPolish ? "Bilety i szczegóły" : "Tickets and details"}</a></li>`)
      .join("")
    const intro = isPolish
      ? `Masz kod promocyjny na bilet na nasz najbliższy koncert: ${nearest.title}. Kod działa także dla pozostałych koncertów z listy poniżej, o ile dana pula sprzedaży go obsługuje.`
      : `You have a ticket promo code for our nearest show: ${nearest.title}. The code also works for the other listed shows when their ticket pool accepts it.`

    return {
      subject: isPolish
        ? `Kod −${discount}% na najbliższy koncert Viryi`
        : `A ${discount}% code for Virya's nearest show`,
      text: `${hello}\n\n${intro}\n\n${isPolish ? "Twój kod" : "Your code"}: ${code}\n${isPolish ? "Rabat" : "Discount"}: ${discount}%\n${isPolish ? "Ważny do" : "Valid until"}: ${expiresAt}\n\n${isPolish ? "Najbliższe koncerty" : "Upcoming shows"}:\n${textEvents}`,
      html: layout({
        eyebrow: "VIRYA // LIVE REWARD",
        title: isPolish ? "Kod na najbliższy koncert" : "A code for the nearest show",
        body:
          paragraph(hello) +
          paragraph(intro) +
          `<div style="margin:22px 0;padding:22px;background:#fff;color:#09090b;text-align:center"><div style="font-family:monospace;font-size:24px;font-weight:800">${escapeHtml(code)}</div><div style="margin-top:8px;font-size:12px;font-weight:800">−${discount}% · ${escapeHtml(expiresAt)}</div></div>` +
          `<h2 style="margin:30px 0 16px;color:#fff;font-size:18px">${isPolish ? "Najbliższe koncerty" : "Upcoming shows"}</h2><ul style="margin:0;padding-left:20px">${htmlEvents}</ul>`,
        button: isPolish ? "Bilety na najbliższy koncert" : "Tickets for the nearest show",
        buttonUrl: nearest.ticketUrl,
      }),
    }
  }

  if (template === "crowdrelay-merch-reward") {
    const code = valueString(variables.coupon_code, 100)
    const discount = Number(variables.discount_percent)
    const expiresAt = formatDate(variables.expires_at, isPolish)
    if (!code || !Number.isFinite(discount) || discount <= 0 || !expiresAt) return null
    return {
      subject: isPolish ? `Nagroda Virya: ${discount}% na merch` : `Virya reward: ${discount}% off merch`,
      text: `${hello}\n\n${isPolish ? "Twój kod" : "Your code"}: ${code}\n${isPolish ? "Rabat" : "Discount"}: ${discount}%\n${isPolish ? "Ważny do" : "Valid until"}: ${expiresAt}`,
      html: layout({
        eyebrow: "VIRYA // REWARD",
        title: isPolish ? `${discount}% na merch` : `${discount}% off merch`,
        body:
          paragraph(hello) +
          `<div style="margin:22px 0;padding:22px;background:#fff;color:#09090b;text-align:center;font-family:monospace;font-size:24px;font-weight:800">${escapeHtml(code)}</div>` +
          paragraph(`${isPolish ? "Ważny do" : "Valid until"}: ${expiresAt}`),
      }),
    }
  }

  if (template === "crowdrelay-admission-winner") {
    const url = safeUrl(variables.winner_url)
    const reference = valueString(variables.public_reference, 100)
    const expiresAt = formatDate(variables.claim_expires_at, isPolish)
    if (!url || !reference || !expiresAt) return null
    return {
      subject: isPolish ? "Wygrywasz wejściówkę Virya" : "You won a Virya pass",
      text: `${hello}\n\n${isPolish ? "Odbierz wejściówkę" : "Claim your pass"}: ${url}\n${isPolish ? "Numer" : "Reference"}: ${reference}\n${isPolish ? "Odbierz do" : "Claim by"}: ${expiresAt}`,
      html: layout({
        eyebrow: "VIRYA // WINNER",
        title: isPolish ? "Masz wejściówkę" : "You have a pass",
        body:
          paragraph(hello) +
          paragraph(`${isPolish ? "Numer" : "Reference"}: ${reference}`) +
          paragraph(`${isPolish ? "Odbierz do" : "Claim by"}: ${expiresAt}`),
        button: isPolish ? "Odbierz wejściówkę" : "Claim pass",
        buttonUrl: url,
      }),
    }
  }

  if (template === "crowdrelay-admission-redeemed") {
    const reference = valueString(variables.public_reference, 100)
    const redeemedAt = formatDate(variables.redeemed_at, isPolish)
    if (!reference || !redeemedAt) return null
    return {
      subject: `CrowdRelay: admission redeemed ${reference}`,
      text: `Admission redeemed\nReference: ${reference}\nTime: ${redeemedAt}`,
      html: layout({
        eyebrow: "CROWDRELAY // GATE",
        title: "Admission redeemed",
        body: paragraph(`Reference: ${reference}`) + paragraph(`Time: ${redeemedAt}`),
      }),
    }
  }

  return null
}

const parsePayload = (raw: unknown): MailPayload | null => {
  const body = asRecord(raw)
  if (!body) return null
  const template = valueString(body.template, 100)
  const variables = asRecord(body.variables)
  const idempotencyKey = valueString(body.idempotency_key, 200)
  const operation = body.operation === "event" ? "event" : "mail"
  const to = body.to == null ? null : valueString(body.to, 320)?.toLowerCase() ?? null
  if (
    !template ||
    !TEMPLATES.has(template) ||
    !variables ||
    !idempotencyKey ||
    !IDEMPOTENCY_PATTERN.test(idempotencyKey) ||
    (operation === "mail" && (!to || !EMAIL_PATTERN.test(to))) ||
    (to && !EMAIL_PATTERN.test(to))
  ) {
    return null
  }
  return { template, to, variables, idempotencyKey, operation }
}

export const POST: APIRoute = async ({ request }) => {
  const configuredKey = readServerEnv("CROWDRELAY_MAILER_API_KEY", import.meta.env.CROWDRELAY_MAILER_API_KEY)?.trim()
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  if (!configuredKey || configuredKey.length < 24 || !safeEqual(provided, configuredKey)) {
    return json({ error: "unauthorized" }, 401)
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json") {
    return json({ error: "unsupported_media_type" }, 415)
  }

  let rawBody: string
  try {
    rawBody = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json({ error: "request_too_large" }, 413)
    throw error
  }

  let raw: unknown
  try {
    raw = JSON.parse(rawBody) as unknown
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  const payload = parsePayload(raw)
  if (!payload) return json({ error: "invalid_payload" }, 400)

  const rendered = await render(payload.template, payload.variables)
  if (!rendered) return json({ error: "invalid_template_variables" }, 400)

  const mailer = getSiteMailer()
  if (!mailer) return json({ error: "mailer_not_configured" }, 503)
  const recipient = payload.operation === "event" ? mailer.to : payload.to
  if (!recipient) return json({ error: "recipient_not_configured" }, 503)

  let lease: CrowdRelayMailLease
  try {
    lease = await acquireCrowdRelayMailLease(
      payload.idempotencyKey,
      payload.template,
      recipient,
    )
  } catch (error) {
    console.error("[crowdrelay-mail-lease]", payload.template, error)
    return json({ error: "delivery_busy" }, 503)
  }

  if (lease.status === "done") return json({ ok: true, duplicate: true, ...(lease.providerReference ? { provider_reference: lease.providerReference } : {}) })
  if (lease.status === "ambiguous") return json({ error: "delivery_outcome_unknown" }, 409)
  if (lease.status === "busy") return json({ error: "delivery_in_progress" }, 409)

  if (lease.status !== "acquired") return json({ error: "delivery_busy" }, 503)
  const { leaseId } = lease

  try {
    const result = await mailer.send({
      fromName: "Virya Signal",
      to: recipient,
      replyTo: mailer.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: rendered.attachments,
      idempotencyKey: payload.idempotencyKey,
    })
    await completeCrowdRelayMailLease(payload.idempotencyKey, leaseId, result.messageId)
    return json({ ok: true, provider: mailer.provider, provider_reference: result.messageId })
  } catch (error) {
    try {
      await markCrowdRelayMailAmbiguous(payload.idempotencyKey, leaseId)
    } catch (transitionError) {
      console.error("[crowdrelay-mail-ambiguous]", payload.template, transitionError)
    }
    console.error("[crowdrelay-mail]", payload.template, error)
    return json({ error: "delivery_outcome_unknown" }, 503)
  }
}
