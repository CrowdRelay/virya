import { useEffect, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type { PublicEvent } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
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
}

type InterestState = "idle" | "saving" | "saved" | "login" | "error"

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

type CheckinState =
  | "none"
  | "working"
  | "success"
  | "duplicate"
  | "login"
  | "expired"
  | "full"
  | "error"

export default function EventDetail({ lang, slug, initialEvent = null }: Props) {
  const copy = SIGNAL_COPY[lang].event
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [event, setEvent] = useState<PublicEvent | null>(initialEvent)
  const [unavailable, setUnavailable] = useState(false)
  const [interestState, setInterestState] = useState<InterestState>("idle")
  const [checkinState, setCheckinState] = useState<CheckinState>("none")
  const [shareLabel, setShareLabel] = useState(copy.share)

  useEffect(() => {
    let cancelled = false
    const trackViewOnce = () => {
      const key = `virya-signal-event-view:${slug}`
      try {
        if (sessionStorage.getItem(key) === "1") return
        sessionStorage.setItem(key, "1")
      } catch {
        // Storage can be unavailable in hardened browsers; analytics remains best effort.
      }
      bestEffort(crowdrelay.trackView(slug, campaignIdFromLocation()))
    }

    if (initialEvent) {
      trackViewOnce()
      return () => { cancelled = true }
    }

    void crowdrelay
      .getEvent(slug, campaignIdFromLocation())
      .then(value => {
        if (cancelled) return
        setEvent(value)
        trackViewOnce()
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })
    return () => { cancelled = true }
  }, [slug, initialEvent])

  useEffect(() => {
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
  }, [slug])

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
        ...(campaignIdFromLocation()
          ? { campaign_id: campaignIdFromLocation() }
          : {}),
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
      bestEffort(crowdrelay.trackShare(slug, campaignIdFromLocation()))
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
          href={pagePath(lang, "/signal/#signal-shows")}
          class="mt-5 inline-flex min-h-[44px] items-center text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300"
        >
          ← {copy.back}
        </a>
      </div>
    )
  }

  const campaignId = campaignIdFromLocation()
  const bandsintownRsvp = withTrigger(event.external_event_url, "rsvp_going")
  const bandsintownFollow = "https://www.bandsintown.com/a/15587796-virya?trigger=track"
  const mapUrl = event.venue_address || event.venue || event.city?.name
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.venue_address, event.city?.name].filter(Boolean).join(", "))}`
    : null

  return (
    <article>
      <a
        href={pagePath(lang, "/signal/#signal-shows")}
        class="inline-flex min-h-[44px] items-center text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
      >
        ← {copy.back}
      </a>

      <div class="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[.25em] text-amber-400">
            {formatDate(event.starts_at, locale, event.timezone)}
          </p>
          <h1 class="mt-4 max-w-4xl text-[clamp(2.5rem,8vw,5.5rem)] font-black uppercase leading-[.9] tracking-[-.05em] text-white">
            {event.title}
          </h1>
          {event.description && (
            <p class="mt-7 max-w-3xl text-justify text-sm leading-relaxed text-zinc-300 mobile-justify lg:text-base">
              {event.description}
            </p>
          )}

          {checkinState !== "none" && (
            <CheckinPanel
              lang={lang}
              state={checkinState}
              onRetry={() => void retryCheckin()}
            />
          )}

          <div class="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={registerInterest}
              disabled={interestState === "saving" || interestState === "saved"}
              class="virya-button virya-button--primary min-h-[48px] px-5"
            >
              {interestState === "saving"
                ? copy.interestWorking
                : interestState === "saved"
                  ? copy.interestSaved
                  : copy.interest}
            </button>
            {event.ticket_url && (
              <a
                href={crowdrelay.eventTicketUrl(slug, campaignId)}
                class="virya-button virya-button--accent-outline min-h-[48px] px-5"
              >
                {lang === "pl" ? "Bilety zewnętrzne" : "External tickets"}
              </a>
            )}
            {bandsintownRsvp && (
              <a
                href={bandsintownRsvp}
                target="_blank"
                rel="noopener noreferrer"
                class="virya-button virya-button--secondary min-h-[48px] px-5"
              >
                {lang === "pl" ? "RSVP na Bandsintown" : "RSVP on Bandsintown"}
              </a>
            )}
            <a
              href={bandsintownFollow}
              target="_blank"
              rel="noopener noreferrer"
              class="virya-button virya-button--ghost min-h-[48px] px-3"
            >
              {lang === "pl" ? "Obserwuj Viryę" : "Follow Virya"}
            </a>
            {event.listen_url && (
              <a
                href={crowdrelay.eventListenUrl(slug, campaignId)}
                class="virya-button virya-button--secondary min-h-[48px] px-5"
              >
                {copy.listen}
              </a>
            )}
            <a
              href={crowdrelay.eventCalendarUrl(slug, campaignId)}
              class="virya-button virya-button--ghost min-h-[48px] px-3"
            >
              {copy.calendar}
            </a>
            <button
              type="button"
              onClick={shareEvent}
              class="virya-button virya-button--ghost min-h-[48px] px-3"
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

        <aside class="virya-panel p-5 sm:p-6">
          <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
            VIRYA // LIVE
          </p>
          <dl class="mt-6 space-y-5">
            <div>
              <dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                {copy.venue}
              </dt>
              <dd class="mt-1 text-sm font-bold text-white">
                {event.venue ?? event.city?.name ?? "Virya"}
              </dd>
              {event.venue_address && (
                <dd class="mt-1 text-xs leading-relaxed text-zinc-400">
                  {event.venue_address}
                </dd>
              )}
              {mapUrl && (
                <dd class="mt-3">
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" class="text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300">
                    {lang === "pl" ? "Otwórz mapę" : "Open map"} →
                  </a>
                </dd>
              )}
            </div>
            {event.city && (
              <div>
                <dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  {lang === "pl" ? "Wybrane miasto" : "Signal city"}
                </dt>
                <dd class="mt-1 text-sm font-bold text-white">
                  {event.city.name}
                </dd>
              </div>
            )}
            <div>
              <dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                Timezone
              </dt>
              <dd class="mt-1 font-mono text-xs text-zinc-400">
                {event.timezone}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </article>
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
        <div>
          <p class="text-[9px] font-black uppercase tracking-[.24em] text-amber-400">
            {copy.checkinBonus}
          </p>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-200">
            {body}
          </p>
          {state === "login" && (
            <a
              href={pagePath(lang, "/signal/#join-signal")}
              class="virya-button virya-button--primary mt-4"
            >
              {copy.checkinJoin}
            </a>
          )}
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
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })
    dateFormatters.set(formatterKey, formatter)
  }
  return formatter.format(date)
}
