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

export default function EventDetail({ lang, slug }: Props) {
  const copy = SIGNAL_COPY[lang].event
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [interestState, setInterestState] = useState<InterestState>("idle")
  const [checkinState, setCheckinState] = useState<CheckinState>("none")
  const [shareLabel, setShareLabel] = useState(copy.share)

  useEffect(() => {
    let cancelled = false
    void crowdrelay
      .getEvent(slug, campaignIdFromLocation())
      .then(value => {
        if (cancelled) return
        setEvent(value)
        const key = `virya-signal-event-view:${slug}`
        try {
          if (sessionStorage.getItem(key) !== "1") {
            sessionStorage.setItem(key, "1")
            bestEffort(crowdrelay.trackView(slug, campaignIdFromLocation()))
          }
        } catch {
          bestEffort(crowdrelay.trackView(slug, campaignIdFromLocation()))
        }
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

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
      <div class="border border-zinc-800 bg-zinc-950 p-6" aria-busy="true">
        <p class="text-xs text-zinc-400">{copy.loading}</p>
      </div>
    )
  }

  if (!event || unavailable) {
    return (
      <div class="border border-zinc-800 bg-zinc-950 p-6">
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
            {formatDate(event.starts_at, locale)}
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
              class="inline-flex min-h-[48px] items-center bg-amber-400 px-5 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300 disabled:opacity-60"
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
                class="inline-flex min-h-[48px] items-center border border-amber-400/55 px-5 text-[9px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-400 hover:text-black"
              >
                {copy.tickets}
              </a>
            )}
            {event.listen_url && (
              <a
                href={crowdrelay.eventListenUrl(slug, campaignId)}
                class="inline-flex min-h-[48px] items-center border border-zinc-700 px-5 text-[9px] font-black uppercase tracking-widest text-zinc-200 hover:border-amber-400 hover:text-amber-400"
              >
                {copy.listen}
              </a>
            )}
            <a
              href={crowdrelay.eventCalendarUrl(slug, campaignId)}
              class="inline-flex min-h-[48px] items-center px-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
            >
              {copy.calendar}
            </a>
            <button
              type="button"
              onClick={shareEvent}
              class="inline-flex min-h-[48px] items-center px-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
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

        <aside class="border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
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
              class="mt-4 inline-flex min-h-[44px] items-center bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300"
            >
              {copy.checkinJoin}
            </a>
          )}
          {state === "error" && (
            <button
              type="button"
              onClick={onRetry}
              class="mt-4 inline-flex min-h-[44px] items-center border border-amber-400/50 px-4 text-[9px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-400 hover:text-black"
            >
              {lang === "pl" ? "Spróbuj ponownie" : "Try again"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}
