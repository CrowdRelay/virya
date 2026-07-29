import { useEffect, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type { PublicEvent } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import {
  bestEffort,
  campaignIdFromLocation,
  crowdrelay,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
  slug: string
}

type InterestState = "idle" | "saving" | "saved" | "login" | "error"

export default function EventDetail({ lang, slug }: Props) {
  const copy = SIGNAL_COPY[lang].event
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [interestState, setInterestState] = useState<InterestState>("idle")
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
    const url = location.href
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
            <p class="mt-7 max-w-3xl text-sm leading-relaxed text-zinc-300 text-justify mobile-justify lg:text-base">
              {event.description}
            </p>
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
            <div class="mt-5 border-l-2 border-amber-400 bg-amber-400/[.035] p-4 text-xs leading-relaxed text-zinc-300" role="status">
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
                  Signal city
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

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
