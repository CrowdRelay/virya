import { useEffect, useMemo, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { TicketOrder, TicketWallet as TicketWalletData } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"
import { qrDataUrl } from "../../../lib/qr"
import { captureTicketToken } from "../../../lib/ticketWallet"

interface Props {
  lang: Lang
  orderId: string
}

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "waiting"; order: TicketOrder }
  | { kind: "ready"; wallet: TicketWalletData }
  | { kind: "error" }

const text = {
  pl: {
    eyebrow: "VIRYA // TWOJE BILETY",
    heading: "Bilet jest przypisany do tego urządzenia",
    loading: "Sprawdzam płatność i przygotowuję bilety…",
    waiting: "Płatność jest jeszcze potwierdzana. Ta strona odświeży się automatycznie.",
    missing: "Nie mam na tym urządzeniu prywatnego klucza zamówienia. Otwórz link z maila wysłanego po zakupie.",
    error: "Nie udało się pobrać biletów. Spróbuj ponownie za chwilę albo użyj linku z maila.",
    order: "Zamówienie",
    ticket: "Bilet",
    showAtDoor: "Pokaż ten kod przy wejściu. Każdy bilet można wykorzystać tylko raz.",
    used: "Ten bilet został już wykorzystany.",
    revoked: "Ten bilet został anulowany lub zwrócony.",
    notReady: "Kod pojawi się po potwierdzeniu płatności.",
    resend: "Wyślij bilety ponownie",
    resending: "Zlecam wysyłkę…",
    resent: "Wiadomość została dodana do kolejki wysyłkowej.",
    back: "Wróć do koncertu",
  },
  en: {
    eyebrow: "VIRYA // YOUR TICKETS",
    heading: "This ticket wallet is linked to this device",
    loading: "Checking payment and preparing your tickets…",
    waiting: "Payment is still being confirmed. This page will refresh automatically.",
    missing: "This device does not have the private order key. Open the link from the e-mail sent after purchase.",
    error: "Tickets could not be loaded. Try again shortly or use the link from your e-mail.",
    order: "Order",
    ticket: "Ticket",
    showAtDoor: "Show this code at the door. Each ticket can be redeemed only once.",
    used: "This ticket has already been used.",
    revoked: "This ticket has been cancelled or refunded.",
    notReady: "The QR code will appear after payment confirmation.",
    resend: "Send tickets again",
    resending: "Requesting delivery…",
    resent: "The message has been queued for delivery.",
    back: "Back to the show",
  },
} as const

export default function TicketWallet({ lang, orderId }: Props) {
  const copy = text[lang]
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<State>({ kind: "loading" })
  const [deliveryState, setDeliveryState] = useState<"idle" | "working" | "done" | "error">("idle")

  useEffect(() => {
    const captured = captureTicketToken(orderId)
    setToken(captured)
    if (!captured) setState({ kind: "missing" })
  }, [orderId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    let timer: number | undefined
    let attempts = 0

    const load = async () => {
      attempts += 1
      try {
        const wallet = await crowdrelay.getTicketWallet(orderId, token)
        if (!cancelled) setState({ kind: "ready", wallet })
        return
      } catch (error) {
        if (cancelled) return
        if (error instanceof CrowdRelayError && error.status === 409 && attempts <= 90) {
          try {
            const order = await crowdrelay.getTicketOrder(orderId, token)
            if (!cancelled) setState({ kind: "waiting", order })
          } catch {
            // The next wallet poll remains authoritative.
          }
          timer = window.setTimeout(load, 2_000)
          return
        }
        if (error instanceof CrowdRelayError && (error.status === 401 || error.status === 404)) {
          setState({ kind: "missing" })
        } else {
          setState({ kind: "error" })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [orderId, token])

  const eventSlug = state.kind === "ready"
    ? state.wallet.order.event_slug
    : state.kind === "waiting"
      ? state.order.event_slug
      : null

  const resend = async () => {
    if (!token || deliveryState === "working") return
    setDeliveryState("working")
    try {
      await crowdrelay.requestTicketDelivery(orderId, token)
      setDeliveryState("done")
    } catch {
      setDeliveryState("error")
    }
  }

  return (
    <section class="mx-auto max-w-5xl">
      <p class="virya-eyebrow">{copy.eyebrow}</p>
      <h1 class="virya-heading mt-4">{copy.heading}</h1>

      {state.kind === "loading" && <StatusPanel message={copy.loading} busy />}
      {state.kind === "missing" && <StatusPanel message={copy.missing} />}
      {state.kind === "error" && <StatusPanel message={copy.error} />}
      {state.kind === "waiting" && (
        <div class="mt-8">
          <StatusPanel message={copy.waiting} busy />
          <OrderSummary order={state.order} lang={lang} />
        </div>
      )}
      {state.kind === "ready" && (
        <div class="mt-8 grid gap-6">
          <OrderSummary order={state.wallet.order} lang={lang} />
          <div class="grid gap-5 md:grid-cols-2">
            {state.wallet.tickets.map(ticket => (
              <article key={ticket.pass_id} class="virya-panel overflow-hidden border-amber-400/25">
                <div class="border-b border-zinc-800 p-5">
                  <p class="text-[8px] font-black uppercase tracking-[.26em] text-amber-400">{copy.ticket} {ticket.sequence}</p>
                  <h2 class="mt-2 text-lg font-black uppercase text-white">{ticket.ticket_type_name}</h2>
                  <p class="mt-2 font-mono text-[10px] tracking-widest text-zinc-400">{ticket.public_reference}</p>
                </div>
                <div class="p-5 text-center">
                  {ticket.status === "claimed" && ticket.qr_token ? (
                    <>
                      <img
                        src={qrDataUrl(ticket.qr_token, 8, 4)}
                        width="328"
                        height="328"
                        alt={`${copy.ticket} ${ticket.public_reference}`}
                        class="mx-auto aspect-square w-full max-w-[328px] bg-white p-2 [image-rendering:pixelated]"
                      />
                      <p class="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-zinc-300">{copy.showAtDoor}</p>
                    </>
                  ) : ticket.status === "redeemed" ? (
                    <TicketStatus message={copy.used} />
                  ) : ticket.status === "revoked" || ticket.status === "expired" ? (
                    <TicketStatus message={copy.revoked} danger />
                  ) : (
                    <TicketStatus message={copy.notReady} />
                  )}
                </div>
              </article>
            ))}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" onClick={resend} disabled={deliveryState === "working" || deliveryState === "done"} class="virya-button virya-button--secondary min-h-[46px] px-5">
              {deliveryState === "working" ? copy.resending : deliveryState === "done" ? copy.resent : copy.resend}
            </button>
            {deliveryState === "error" && <span class="text-xs text-red-300">{copy.error}</span>}
          </div>
        </div>
      )}

      {eventSlug && (
        <a href={pagePath(lang, `/live/${eventSlug}/`)} class="mt-8 inline-flex min-h-[44px] items-center text-[9px] font-black uppercase tracking-widest text-amber-400">
          ← {copy.back}
        </a>
      )}
    </section>
  )
}

function StatusPanel({ message, busy = false }: { message: string; busy?: boolean }) {
  return <div class="virya-panel mt-8 border-amber-400/25 p-6" aria-busy={busy}><p class="text-sm leading-relaxed text-zinc-300" role="status">{message}</p></div>
}

function TicketStatus({ message, danger = false }: { message: string; danger?: boolean }) {
  return <div class={`border p-6 text-sm font-bold ${danger ? "border-red-400/30 bg-red-400/[.035] text-red-200" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>{message}</div>
}

function OrderSummary({ order, lang }: { order: TicketOrder; lang: Lang }) {
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: order.currency }).format(order.amount_gross_minor / 100)
  return (
    <article class="virya-panel grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
      <div>
        <p class="text-[8px] font-black uppercase tracking-[.25em] text-zinc-500">{order.public_reference}</p>
        <h2 class="mt-2 text-xl font-black uppercase text-white">{order.event_title}</h2>
        <p class="mt-2 text-xs text-zinc-400">{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: order.timezone }).format(new Date(order.starts_at))}{order.venue ? ` · ${order.venue}` : ""}</p>
      </div>
      <strong class="text-2xl font-black text-amber-400">{amount}</strong>
    </article>
  )
}

function pagePath(lang: Lang, path: string) {
  return lang === "pl" ? `/pl${path}` : path
}
