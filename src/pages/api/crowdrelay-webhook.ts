import { createHmac, timingSafeEqual } from "node:crypto"
import { getStore } from "@netlify/blobs"
import type { APIRoute } from "astro"
import { VIRYA_SITE_ORIGIN } from "../../config"
import { getSiteMailer } from "../../server/siteMailer"

const MAX_BODY_BYTES = 16 * 1024
const MAX_CLOCK_SKEW_SECONDS = 5 * 60
const STORE_NAME = "virya-crowdrelay-webhooks"
const EVENT_ID = /^(evt_[0-9a-f]{32}|[0-9a-f-]{20,64})$/i
const TOKEN = /^[0-9a-f]{64}$/i

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left, "utf8")
  const b = Buffer.from(right, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

const verifySignature = (rawBody: string, timestamp: string, signature: string) => {
  const secret = import.meta.env.CROWDRELAY_WEBHOOK_SECRET
  if (!secret || secret.length < 24) return false
  if (!/^\d{10,13}$/.test(timestamp)) return false

  const seconds = Number(timestamp)
  if (!Number.isSafeInteger(seconds)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false
  }

  const received = signature.startsWith("v1=") ? signature.slice(3) : ""
  if (!/^[0-9a-f]{64}$/i.test(received)) return false
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")
  return safeEqual(received.toLowerCase(), expected)
}

type Envelope = {
  id: string
  type: string
  version: number
  occurred_at?: string
  data: Record<string, unknown>
}

const parseEnvelope = (rawBody: string): Envelope | null => {
  try {
    const value = JSON.parse(rawBody) as Partial<Envelope>
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.id !== "string" ||
      !EVENT_ID.test(value.id) ||
      typeof value.type !== "string" ||
      value.version !== 1 ||
      !value.data ||
      typeof value.data !== "object" ||
      Array.isArray(value.data)
    ) {
      return null
    }
    return value as Envelope
  } catch {
    return null
  }
}

const publicBaseUrl = () =>
  VIRYA_SITE_ORIGIN

const localePath = (locale: unknown, path: string) =>
  typeof locale === "string" && locale.toLowerCase().startsWith("pl")
    ? `/pl${path}`
    : path

const sendConfirmation = async (data: Record<string, unknown>, eventId: string) => {
  const email = typeof data.email === "string" ? data.email.trim() : ""
  const token =
    typeof data.confirmation_token === "string" ? data.confirmation_token : ""
  if (!email || !TOKEN.test(token)) throw new Error("invalid_confirmation_payload")

  const isPolish =
    typeof data.locale === "string" && data.locale.toLowerCase().startsWith("pl")
  const name = typeof data.display_name === "string" ? data.display_name.trim() : ""
  const path = localePath(data.locale, "/signal/confirm")
  const confirmationUrl = `${publicBaseUrl()}${path}#token=${encodeURIComponent(token)}`
  const mailer = getSiteMailer()
  if (!mailer) throw new Error("mailer_not_configured")

  await mailer.send({
    fromName: isPolish ? "Sygnał Virya" : "Virya Signal",
    to: email,
    replyTo: mailer.to,
    idempotencyKey: `fan-confirmation/${eventId}`,
    subject: isPolish ? "Potwierdź swój Sygnał Virya" : "Confirm your Virya Signal",
    text: isPolish
      ? `${name ? `Cześć ${name}!\n\n` : "Cześć!\n\n"}Potwierdź adres, aby aktywować Sygnał Virya:\n${confirmationUrl}\n\nSygnał łączy koncerty, Grę Virya, nagrody i merch. Jeśli to nie Ty, zignoruj wiadomość.`
      : `${name ? `Hi ${name}!\n\n` : "Hi!\n\n"}Confirm your address to activate Virya Signal:\n${confirmationUrl}\n\nSignal connects Virya shows, AREA, rewards and merch. If this was not you, ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#e4e4e7;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:40px 24px"><p style="color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.18em">${isPolish ? "VIRYA // SYGNAŁ" : "VIRYA // SIGNAL"}</p><h1 style="font-size:30px;line-height:1.05;color:#fff">${isPolish ? "Potwierdź swój sygnał" : "Confirm your signal"}</h1><p style="line-height:1.7">${isPolish ? "Jedno kliknięcie aktywuje prywatną przestrzeń fana: koncerty, Grę Virya, nagrody i merch w jednym miejscu." : "One click activates your private fan space: shows, AREA, rewards and merch in one ecosystem."}</p><p style="margin:32px 0"><a href="${confirmationUrl}" style="display:inline-block;background:#fbbf24;color:#09090b;padding:16px 22px;text-decoration:none;font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.12em">${isPolish ? "Aktywuj Sygnał" : "Activate Signal"}</a></p><p style="color:#71717a;font-size:12px;line-height:1.6">${isPolish ? "Jeśli przycisk nie działa, skopiuj adres:" : "If the button does not work, copy this address:"}<br>${confirmationUrl}</p></div></body></html>`,
  })
}

const sendWelcome = async (data: Record<string, unknown>, eventId: string) => {
  const email = typeof data.email === "string" ? data.email.trim() : ""
  const referralCode =
    typeof data.referral_code === "string" ? data.referral_code.trim() : ""
  const unsubscribeToken =
    typeof data.unsubscribe_token === "string" ? data.unsubscribe_token : ""
  if (!email || !referralCode || !TOKEN.test(unsubscribeToken)) {
    throw new Error("invalid_welcome_payload")
  }

  const isPolish =
    typeof data.locale === "string" && data.locale.toLowerCase().startsWith("pl")
  const base = publicBaseUrl()
  const accountUrl = `${base}${localePath(data.locale, "/my-signal/")}`
  const referralUrl = `${base}${localePath(data.locale, "/signal/")}?ref=${encodeURIComponent(referralCode)}`
  const unsubscribeUrl = `${base}${localePath(data.locale, "/signal/unsubscribe")}#token=${encodeURIComponent(unsubscribeToken)}`
  const mailer = getSiteMailer()
  if (!mailer) throw new Error("mailer_not_configured")

  await mailer.send({
    fromName: isPolish ? "Sygnał Virya" : "Virya Signal",
    to: email,
    replyTo: mailer.to,
    idempotencyKey: `fan-welcome/${eventId}`,
    subject: isPolish ? "Twój Sygnał Virya jest aktywny" : "Your Virya Signal is active",
    text: isPolish
      ? `Twój Sygnał działa.\n\nMój Sygnał: ${accountUrl}\nLink polecający: ${referralUrl}\n\nWypisz się: ${unsubscribeUrl}`
      : `Your Signal is active.\n\nMy Signal: ${accountUrl}\nReferral link: ${referralUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#e4e4e7;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:40px 24px"><p style="color:#fbbf24;font-size:12px;font-weight:800;letter-spacing:.18em">${isPolish ? "VIRYA // SYGNAŁ" : "VIRYA // SIGNAL"}</p><h1 style="color:#fff">${isPolish ? "Sygnał aktywny" : "Signal active"}</h1><p style="line-height:1.7">${isPolish ? "Od teraz koncerty, Gra Virya, limitowane pule nagród i korzyści merchowe są połączone w jednym prostym systemie." : "Shows, AREA, limited reward pools and merch benefits can now work as one system."}</p><p><a href="${accountUrl}" style="display:inline-block;background:#fbbf24;color:#09090b;padding:16px 22px;text-decoration:none;font-weight:800">${isPolish ? "OTWÓRZ MÓJ SYGNAŁ" : "OPEN MY SIGNAL"}</a></p><p style="margin-top:28px;font-size:13px">${isPolish ? "Twój link polecający:" : "Your referral link:"}<br><a style="color:#fbbf24" href="${referralUrl}">${referralUrl}</a></p><p style="margin-top:36px"><a style="color:#71717a;font-size:11px" href="${unsubscribeUrl}">${isPolish ? "Wypisz mnie" : "Unsubscribe"}</a></p></div></body></html>`,
  })
}

const handleEnvelope = async (envelope: Envelope) => {
  switch (envelope.type) {
    case "fan.confirmation_requested":
      await sendConfirmation(envelope.data, envelope.id)
      return
    case "fan.confirmed":
      await sendWelcome(envelope.data, envelope.id)
      return
    case "fan.created":
    case "fan.unsubscribed":
    case "merch.coupon_issued":
    case "event.interest_recorded":
    case "event.reminder_due":
    case "admission.pass_issued":
    case "admission.pass_redeemed":
      return
    default:
      throw new Error("unsupported_event")
  }
}

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413)
  }

  const timestamp = request.headers.get("crowdrelay-timestamp") ?? ""
  const signature = request.headers.get("crowdrelay-signature") ?? ""
  if (!verifySignature(rawBody, timestamp, signature)) {
    return json({ error: "invalid_signature" }, 401)
  }

  const envelope = parseEnvelope(rawBody)
  if (!envelope) return json({ error: "invalid_event" }, 400)
  const headerEventId = request.headers.get("crowdrelay-event-id")
  const headerEventType = request.headers.get("crowdrelay-event-type")
  if (headerEventId !== envelope.id || headerEventType !== envelope.type) {
    return json({ error: "event_header_mismatch" }, 400)
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" })
  const key = `events/${envelope.id}`
  const existing = await store.get(key, { type: "json", consistency: "strong" })
  if (existing) return json({ ok: true, duplicate: true })

  try {
    await handleEnvelope(envelope)
    await store.setJSON(key, {
      type: envelope.type,
      processedAt: new Date().toISOString(),
    })
    return json({ ok: true })
  } catch (error) {
    console.error("[crowdrelay-webhook]", envelope.id, envelope.type, error)
    return json({ error: "delivery_failed" }, 503)
  }
}
