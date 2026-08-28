import type { ComponentChildren } from "preact"
import { useEffect, useMemo, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type {
  FanEventContextSnapshot,
  PublicEvent,
  TicketSaleOffer,
} from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { normalizeTicketInventory } from "../../../lib/ticketInventory"
import TicketInventoryBar from "../tickets/TicketInventoryBar"
import {
  bestEffort,
  campaignIdFromLocation,
  captureConcertCheckinFromLocation,
  clearPendingConcertCheckin,
  crowdrelay,
  getPendingConcertCheckin,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
  slug: string
  initialEvent?: PublicEvent | null
  initialTicketSale?: TicketSaleOffer | null
}

type InterestState = "idle" | "saving" | "saved" | "login" | "error"
type CheckinState =
  | "none"
  | "working"
  | "success"
  | "duplicate"
  | "login"
  | "expired"
  | "full"
  | "error"

const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()
const moneyFormatters = new Map<string, Intl.NumberFormat>()

export default function EventDetail({
  lang,
  slug,
  initialEvent = null,
  initialTicketSale = null,
}: Props) {
  const copy = SIGNAL_COPY[lang].event
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [event, setEvent] = useState<PublicEvent | null>(initialEvent)
  const [unavailable, setUnavailable] = useState(false)
  const [interestState, setInterestState] = useState<InterestState>("idle")
  const [fanContext, setFanContext] = useState<FanEventContextSnapshot | null>(
    null,
  )
  const [checkinState, setCheckinState] = useState<CheckinState>("none")
  const [shareLabel, setShareLabel] = useState(copy.share)
  const campaignId = useMemo(() => campaignIdFromLocation(), [])

  useEffect(() => {
    let cancelled = false
    const trackViewOnce = (value: PublicEvent) => {
      if (value.source !== "crowdrelay") return
      const key = `virya-signal-event-view:${slug}`
      try {
        if (sessionStorage.getItem(key) === "1") return
        sessionStorage.setItem(key, "1")
      } catch {
        // Storage can be unavailable in hardened browsers; analytics remains best effort.
      }
      bestEffort(crowdrelay.trackView(slug, campaignId))
    }

    if (initialEvent) {
      trackViewOnce(initialEvent)
      return () => {
        cancelled = true
      }
    }

    void crowdrelay
      .getEvent(slug, campaignId)
      .then(value => {
        if (cancelled) return
        setEvent(value)
        trackViewOnce(value)
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, initialEvent, campaignId])

  useEffect(() => {
    const source = event?.source ?? initialEvent?.source
    if (source !== "crowdrelay") return
    let cancelled = false
    void crowdrelay
      .getFanEventContext(slug)
      .then(value => {
        if (cancelled) return
        setFanContext(value)
        if (value.interested) setInterestState("saved")
      })
      .catch(error => {
        if (cancelled) return
        // This is private enrichment only. Public event rendering remains fully
        // usable for anonymous fans and during transient context failures.
        if (!(error instanceof CrowdRelayError && error.status === 401)) {
          setFanContext(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug, event?.source, initialEvent?.source])

  useEffect(() => {
    if (initialEvent?.source && initialEvent.source !== "crowdrelay") return
    const pending = captureConcertCheckinFromLocation(slug)
    if (!pending) return
    let cancelled = false
    setCheckinState("working")

    void crowdrelay
      .checkInToEvent(slug, pending.token)
      .then(result => {
        if (cancelled) return
        clearPendingConcertCheckin()
        setCheckinState(result.created ? "success" : "duplicate")
        setInterestState("saved")
      })
      .catch(error => {
        if (cancelled) return
        if (error instanceof CrowdRelayError && error.status === 401) {
          setCheckinState("login")
        } else if (error instanceof CrowdRelayError && error.status === 404) {
          clearPendingConcertCheckin()
          setCheckinState("expired")
        } else if (error instanceof CrowdRelayError && error.status === 409) {
          clearPendingConcertCheckin()
          setCheckinState("full")
        } else {
          setCheckinState("error")
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug, initialEvent?.source])

  async function retryCheckin() {
    const pending = getPendingConcertCheckin(slug)
    if (!pending || checkinState === "working") return
    setCheckinState("working")
    try {
      const result = await crowdrelay.checkInToEvent(slug, pending.token)
      clearPendingConcertCheckin()
      setCheckinState(result.created ? "success" : "duplicate")
      setInterestState("saved")
    } catch (error) {
      if (error instanceof CrowdRelayError && error.status === 401) {
        setCheckinState("login")
      } else if (error instanceof CrowdRelayError && error.status === 404) {
        clearPendingConcertCheckin()
        setCheckinState("expired")
      } else if (error instanceof CrowdRelayError && error.status === 409) {
        clearPendingConcertCheckin()
        setCheckinState("full")
      } else {
        setCheckinState("error")
      }
    }
  }

  async function registerInterest() {
    if (interestState === "saving" || interestState === "saved") return
    setInterestState("saving")
    try {
      await crowdrelay.registerEventInterest(slug, {
        source: "virya_signal_event",
        ...(campaignId ? { campaign_id: campaignId } : {}),
      })
      setInterestState("saved")
    } catch (error) {
      if (error instanceof CrowdRelayError && error.status === 401) {
        setInterestState("login")
      } else {
        setInterestState("error")
      }
    }
  }

  async function shareEvent() {
    if (!event) return
    const url = `${location.origin}${location.pathname}${location.search}`
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
      setShareLabel(copy.shared)
      if (event.source === "crowdrelay") {
        bestEffort(crowdrelay.trackShare(slug, campaignId))
      }
    } catch {
      setShareLabel(copy.share)
    }
  }

  if (!event && !unavailable) {
    return (
      <div class="virya-panel p-6" aria-busy="true">
        <p class="text-xs text-zinc-400">{copy.loading}</p>
      </div>
    )
  }

  if (!event || unavailable) {
    return (
      <div class="virya-panel p-6">
        <p class="text-sm text-zinc-300">{copy.unavailable}</p>
        <a
          href={pagePath(lang, "/#shows")}
          class="mt-5 inline-flex min-h-11 items-center text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300"
        >
          ← {copy.back}
        </a>
      </div>
    )
  }

  const isCrowdRelayEvent = event.source === "crowdrelay"
  const bandsintownRsvp = withTrigger(event.external_event_url, "rsvp_going")
  const bandsintownFollow =
    "https://www.bandsintown.com/a/15587796-virya?trigger=track"
  const mapQuery = [event.venue, event.venue_address, event.city?.name]
    .filter(Boolean)
    .join(", ")
  const mapUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null
  const externalTicketUrl = event.ticket_url
    ? isCrowdRelayEvent
      ? crowdrelay.eventTicketUrl(slug, campaignId)
      : event.ticket_url
    : null
  const calendarUrl = isCrowdRelayEvent
    ? crowdrelay.eventCalendarUrl(slug, campaignId)
    : null
  const listenUrl = event.listen_url
    ? isCrowdRelayEvent
      ? crowdrelay.eventListenUrl(slug, campaignId)
      : event.listen_url
    : null
  const lowestPrice = initialTicketSale
    ? lowestAvailablePrice(initialTicketSale)
    : null
  const ticketInventory = initialTicketSale
    ? normalizeTicketInventory(initialTicketSale)
    : null
  const saleOpen = initialTicketSale?.sales_state === "open"
  const saleStateLabel = initialTicketSale
    ? ticketStateLabel(initialTicketSale, lang)
    : null

  return (
    <article class="virya-event-detail">
      <a
        href={pagePath(lang, "/#shows")}
        class="inline-flex min-h-11 items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:text-amber-400"
      >
        <span aria-hidden="true">←</span>
        {lang === "pl" ? "Wszystkie koncerty" : "All shows"}
      </a>

      <header class="virya-event-hero mt-5">
        <div class="virya-event-hero__grid">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <span class="virya-event-status">
                <span class="virya-event-status__dot" aria-hidden="true" />
                {lang === "pl" ? "Nadchodzący koncert" : "Upcoming show"}
              </span>
              {saleStateLabel && (
                <span
                  class={`virya-event-ticket-state virya-event-ticket-state--${initialTicketSale?.sales_state}`}
                >
                  {saleStateLabel}
                </span>
              )}
            </div>

            <p class="mt-6 font-mono text-[10px] uppercase tracking-[.24em] text-amber-400">
              {formatDate(event.starts_at, locale, event.timezone)}
            </p>
            <h1 class="mt-4 max-w-5xl text-[clamp(2.5rem,8vw,6.5rem)] font-black uppercase leading-[.86] tracking-[-.055em] text-white">
              {event.title}
            </h1>
            <p class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[.12em] text-zinc-400 sm:text-sm">
              <span class="text-white">
                {event.venue ?? event.city?.name ?? "Virya live"}
              </span>
              {event.city?.name && event.venue && (
                <span aria-hidden="true">//</span>
              )}
              {event.city?.name && event.venue && (
                <span>{event.city.name}</span>
              )}
            </p>

            {event.description && (
              <section
                class="virya-event-description mt-7 max-w-3xl"
                aria-labelledby="event-description-heading"
              >
                <p
                  id="event-description-heading"
                  class="text-[9px] font-black uppercase tracking-[.22em] text-amber-400"
                >
                  {lang === "pl" ? "O koncercie" : "About the show"}
                </p>
                <p class="virya-prose mt-3 text-sm leading-relaxed text-zinc-300 lg:text-base">
                  {event.description}
                </p>
              </section>
            )}

            {checkinState !== "none" && (
              <CheckinPanel
                lang={lang}
                state={checkinState}
                onRetry={() => void retryCheckin()}
              />
            )}

            {fanContext &&
              (fanContext.pass_status ||
                fanContext.paid_ticket_quantity > 0 ||
                fanContext.interested) && (
                <aside
                  class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-amber-300/20 bg-amber-300/[.035] px-4 py-3 text-[9px] font-black uppercase tracking-[.16em] text-amber-100"
                  aria-label={
                    lang === "pl"
                      ? "Twój kontekst koncertu"
                      : "Your event context"
                  }
                >
                  <span class="text-amber-300">
                    {lang === "pl" ? "TWÓJ SYGNAŁ" : "YOUR SIGNAL"}
                  </span>
                  {fanContext.pass_status && (
                    <span>
                      {lang === "pl" ? "PASS" : "PASS"}:{" "}
                      {fanContext.pass_status}
                    </span>
                  )}
                  {fanContext.paid_ticket_quantity > 0 && (
                    <span>
                      {lang === "pl" ? "BILETY" : "TICKETS"}:{" "}
                      {fanContext.paid_ticket_quantity}
                    </span>
                  )}
                  {fanContext.interested && (
                    <span>{lang === "pl" ? "OBSERWUJESZ" : "FOLLOWING"}</span>
                  )}
                </aside>
              )}

            <div class="mt-8 flex flex-wrap gap-3">
              {fanContext && fanContext.paid_ticket_quantity > 0 ? (
                <a
                  href={pagePath(lang, "/my-signal/")}
                  class="virya-button virya-button--primary min-h-12 px-5"
                >
                  {lang === "pl" ? "Masz bilet — otwórz portfel" : "You have a ticket — view wallet"}
                  <span class="ml-2" aria-hidden="true">
                    →
                  </span>
                </a>
              ) : fanContext && fanContext.pass_status ? (
                <a
                  href={pagePath(lang, "/my-signal/")}
                  class="virya-button virya-button--primary min-h-12 px-5"
                >
                  {lang === "pl" ? "Twój pass jest gotowy" : "Your pass is ready"}
                  <span class="ml-2" aria-hidden="true">
                    →
                  </span>
                </a>
              ) : saleOpen && (
                <a
                  href="#tickets"
                  class="virya-button virya-button--primary min-h-12 px-5"
                >
                  {lang === "pl" ? "Kup bilet" : "Buy tickets"}
                  {lowestPrice != null && (
                    <span class="ml-2 font-mono">
                      {lang === "pl" ? "od" : "from"}{" "}
                      {money(lowestPrice, initialTicketSale!.currency, locale)}
                    </span>
                  )}
                  <span class="ml-2" aria-hidden="true">
                    ↓
                  </span>
                </a>
              )}
              {isCrowdRelayEvent && !saleOpen && (
                <button
                  type="button"
                  onClick={registerInterest}
                  disabled={
                    interestState === "saving" || interestState === "saved"
                  }
                  class="virya-button virya-button--primary min-h-12 px-5"
                >
                  {interestState === "saving"
                    ? copy.interestWorking
                    : interestState === "saved"
                      ? copy.interestSaved
                      : copy.interest}
                </button>
              )}
              {!initialTicketSale && externalTicketUrl && (
                <a
                  href={externalTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="virya-button virya-button--accent-outline min-h-12 px-5"
                >
                  {lang === "pl" ? "Bilety zewnętrzne" : "External tickets"}
                  <span class="ml-2" aria-hidden="true">
                    ↗
                  </span>
                </a>
              )}
              {calendarUrl && (
                <a href={calendarUrl} class="virya-button virya-button--secondary min-h-12 px-5">
                  {copy.calendar} <span class="ml-2" aria-hidden="true">↓</span>
                </a>
              )}
            </div>

            <div class="mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {isCrowdRelayEvent && saleOpen && (
                <button
                  type="button"
                  onClick={registerInterest}
                  disabled={interestState === "saving" || interestState === "saved"}
                  class="virya-event-text-link disabled:opacity-50"
                >
                  {interestState === "saving" ? copy.interestWorking : interestState === "saved" ? copy.interestSaved : copy.interest}
                </button>
              )}
              {bandsintownRsvp && (
                <a
                  href={bandsintownRsvp}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="virya-event-text-link"
                >
                  {lang === "pl"
                    ? "RSVP na Bandsintown"
                    : "RSVP on Bandsintown"}{" "}
                  ↗
                </a>
              )}
              <a
                href={bandsintownFollow}
                target="_blank"
                rel="noopener noreferrer"
                class="virya-event-text-link"
              >
                {lang === "pl" ? "Obserwuj Viryę" : "Follow Virya"} ↗
              </a>
              {listenUrl && (
                <a href={listenUrl} class="virya-event-text-link">
                  {copy.listen} →
                </a>
              )}
              <button
                type="button"
                onClick={shareEvent}
                class="virya-event-text-link"
              >
                {shareLabel}
              </button>
            </div>

            {(interestState === "login" || interestState === "error") && (
              <div
                class="mt-5 border-l-2 border-amber-400 bg-amber-400/[.035] p-4 text-xs leading-relaxed text-zinc-300"
                role="status"
              >
                {interestState === "login"
                  ? copy.interestLogin
                  : SIGNAL_COPY[lang].form.saveError}
                {interestState === "login" && (
                  <a
                    href={pagePath(lang, "/signal/#join-signal")}
                    class="ml-2 font-black uppercase tracking-widest text-amber-400"
                  >
                    {SIGNAL_COPY[lang].account.join} →
                  </a>
                )}
              </div>
            )}
          </div>

          <aside class="virya-event-facts">
            <p class="virya-eyebrow">VIRYA // LIVE DATA</p>
            <dl class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <Fact label={lang === "pl" ? "Start" : "Start"}>
                {formatTime(event.starts_at, locale, event.timezone)}
              </Fact>
              {event.doors_at && (
                <Fact label={lang === "pl" ? "Otwarcie drzwi" : "Doors"}>
                  {formatTime(event.doors_at, locale, event.timezone)}
                </Fact>
              )}
              <Fact label={copy.venue}>
                {event.venue ?? event.city?.name ?? "Virya"}
                {event.venue_address && (
                  <span class="mt-1 block text-xs font-normal leading-relaxed text-zinc-400">
                    {event.venue_address}
                  </span>
                )}
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-3 block text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300"
                  >
                    {lang === "pl" ? "Otwórz mapę" : "Open map"} →
                  </a>
                )}
              </Fact>
            </dl>

            {initialTicketSale && ticketInventory && (
              <div class="mt-6 hidden border-t border-zinc-800 pt-6 sm:block">
                <div class="flex items-end justify-between gap-4">
                  <div>
                    <p class="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">
                      {lang === "pl" ? "Pula Virya" : "Virya allocation"}
                    </p>
                    <p class="mt-2 text-3xl font-black text-white">
                      {ticketInventory.available}
                      <span class="ml-1 text-sm text-zinc-500">
                        / {ticketInventory.capacity}
                      </span>
                    </p>
                  </div>
                  {lowestPrice != null && (
                    <p class="text-right text-xs font-bold text-amber-400">
                      {lang === "pl" ? "od" : "from"}
                      <br />
                      <strong class="text-lg text-white">
                        {money(lowestPrice, initialTicketSale.currency, locale)}
                      </strong>
                    </p>
                  )}
                </div>
                <TicketInventoryBar
                  inventory={initialTicketSale}
                  lang={lang}
                  compact
                  class="mt-4"
                />
              </div>
            )}
          </aside>
        </div>
      </header>
    </article>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: ComponentChildren
}) {
  return (
    <div>
      <dt class="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">
        {label}
      </dt>
      <dd class="mt-2 text-sm font-bold text-white">{children}</dd>
    </div>
  )
}

function CheckinPanel({
  lang,
  state,
  onRetry,
}: {
  lang: Lang
  state: Exclude<CheckinState, "none">
  onRetry: () => void
}) {
  const copy = SIGNAL_COPY[lang].event
  const [inlineEmail, setInlineEmail] = useState("")
  const [inlineState, setInlineState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const success = state === "success" || state === "duplicate"
  const body =
    state === "working"
      ? copy.checkinWorking
      : state === "success"
        ? copy.checkinSuccess
        : state === "duplicate"
          ? copy.checkinAlready
          : state === "login"
            ? copy.checkinLogin
            : state === "expired"
              ? copy.checkinExpired
              : state === "full"
                ? copy.checkinFull
                : copy.checkinError

  async function submitInlineSignup(event: Event) {
    event.preventDefault()
    const email = inlineEmail.trim()
    if (!email || inlineState === "sending") return
    setInlineState("sending")
    try {
      const response = await fetch("/api/signal-preregister", {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale: lang }),
      })
      if (!response.ok) throw new Error("preregister failed")
      setInlineState("sent")
    } catch {
      setInlineState("error")
    }
  }

  return (
    <section
      class={`mt-7 border p-4 sm:p-5 ${
        success
          ? "border-emerald-400/35 bg-emerald-400/[.035]"
          : "border-amber-400/35 bg-amber-400/[.035]"
      }`}
      aria-live="polite"
      aria-busy={state === "working"}
    >
      <div class="flex items-start gap-3">
        <span
          class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            state === "working"
              ? "animate-pulse bg-amber-400"
              : success
                ? "bg-emerald-400"
                : "bg-zinc-500"
          }`}
          aria-hidden="true"
        />
        <div class="w-full">
          <p class="text-[9px] font-black uppercase tracking-[.24em] text-amber-400">
            {copy.checkinBonus}
          </p>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-200">
            {body}
          </p>
          {state === "login" && inlineState === "sent" ? (
            <p class="mt-3 border-l-2 border-emerald-400 bg-emerald-400/[.04] p-3 text-xs font-semibold text-emerald-200">
              {copy.checkinInlineSent}
            </p>
          ) : state === "login" ? (
            <form onSubmit={submitInlineSignup} class="mt-4 grid gap-3 sm:max-w-md">
              <p class="text-xs leading-relaxed text-zinc-300">
                {copy.checkinInlineEmail}
              </p>
              <div class="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  placeholder={copy.checkinInlinePlaceholder}
                  class="virya-input min-h-[44px] flex-1 text-sm"
                  value={inlineEmail}
                  onInput={event => setInlineEmail(event.currentTarget.value)}
                />
                <button
                  type="submit"
                  disabled={inlineState === "sending"}
                  class="virya-button virya-button--primary min-h-[44px] shrink-0 px-4 disabled:cursor-wait"
                >
                  {inlineState === "sending" ? copy.checkinInlineSending : copy.checkinInlineSubmit}
                </button>
              </div>
              {inlineState === "error" && (
                <p class="text-xs text-rose-300">{copy.checkinInlineError}</p>
              )}
              <a
                href={pagePath(lang, "/signal/#join-signal")}
                class="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
              >
                {copy.checkinJoin} →
              </a>
            </form>
          ) : null}
          {state === "error" && (
            <button
              type="button"
              onClick={onRetry}
              class="virya-button virya-button--accent-outline mt-4"
            >
              {lang === "pl" ? "Spróbuj ponownie" : "Try again"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function withTrigger(value: string | null, trigger: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    url.searchParams.set("trigger", trigger)
    return url.toString()
  } catch {
    return null
  }
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatDate(value: string, locale: string, timezone: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const formatterKey = `${locale}:${timezone}`
  let formatter = dateFormatters.get(formatterKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    })
    dateFormatters.set(formatterKey, formatter)
  }
  return formatter.format(date)
}

function formatTime(value: string, locale: string, timezone: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const formatterKey = `${locale}:${timezone}`
  let formatter = timeFormatters.get(formatterKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })
    timeFormatters.set(formatterKey, formatter)
  }
  return formatter.format(date)
}

function money(minor: number, currency: string, locale: string): string {
  const key = `${locale}:${currency}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter.format(minor / 100)
}

function lowestAvailablePrice(sale: TicketSaleOffer): number | null {
  const prices = sale.ticket_types
    .filter(type => type.active && type.available > 0)
    .map(type => type.price_gross_minor)
  return prices.length > 0 ? Math.min(...prices) : null
}

function ticketStateLabel(sale: TicketSaleOffer, lang: Lang): string {
  if (sale.sales_state === "open") {
    const inventory = normalizeTicketInventory(sale)
    const reserved =
      inventory.reserved > 0
        ? lang === "pl"
          ? ` · ${inventory.reserved} w płatności`
          : ` · ${inventory.reserved} in payment`
        : ""
    return lang === "pl"
      ? `${inventory.available} biletów dostępnych${reserved}`
      : `${inventory.available} tickets available${reserved}`
  }
  if (sale.sales_state === "upcoming") {
    return lang === "pl" ? "Sprzedaż wkrótce" : "Tickets on sale soon"
  }
  if (sale.sales_state === "sold_out") {
    return lang === "pl" ? "Wyprzedane" : "Sold out"
  }
  return lang === "pl" ? "Sprzedaż online zamknięta" : "Online sales closed"
}
