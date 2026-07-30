import { useEffect, useMemo, useState } from "preact/hooks"
import type { Lang } from "../../i18n/t"
import type { PublicEvent } from "../../lib/crowdrelay-client"
import { loadLiveEvents } from "../../lib/liveEvents"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"
import LiveEventCard from "./LiveEventCard"

type Props = {
  lang: Lang
  messages: Record<string, string>
}

const SkeletonCard = () => (
  <div class="virya-live-card min-h-52 animate-pulse p-6" aria-hidden="true">
    <div class="grid gap-6 sm:grid-cols-[80px_minmax(0,1fr)]">
      <div class="h-20 w-20 bg-zinc-800" />
      <div>
        <div class="h-3 w-24 bg-zinc-800" />
        <div class="mt-5 h-6 w-3/4 bg-zinc-800" />
        <div class="mt-4 h-3 w-1/2 bg-zinc-900" />
      </div>
    </div>
  </div>
)

const ShowsInner = ({ lang }: { lang: Lang }) => {
  const { t } = useIslandI18n()
  const [events, setEvents] = useState<PublicEvent[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)

    void loadLiveEvents(controller.signal)
      .then(items => {
        if (!cancelled) {
          setEvents(items)
          setUnavailable(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([])
          setUnavailable(true)
        }
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  const upcoming = useMemo(
    () =>
      [...(events ?? [])]
        .filter(event => new Date(event.starts_at).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
        .sort(
          (left, right) =>
            new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
        ),
    [events],
  )

  return (
    <div class="virya-section border-t border-zinc-800/60" aria-labelledby="shows-heading">
      <div class="virya-section__inner">
        <div class="max-w-3xl">
          <p class="virya-eyebrow">VIRYA // LIVE</p>
          <h2 id="shows-heading" class="virya-heading mt-4">{t("shows.heading")}</h2>
          <p class="virya-copy mt-5">{t("shows.sub")}</p>
        </div>

        <div class="mt-10 grid gap-4 lg:grid-cols-2">
          {events === null ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : upcoming.length === 0 ? (
            <div class="virya-panel relative overflow-hidden p-6 lg:col-span-2">
              <div class="virya-live-card__rail" aria-hidden="true" />
              <p class="text-xs uppercase tracking-widest text-zinc-400">
                {unavailable ? (lang === "pl" ? "Koncerty są chwilowo niedostępne." : "Shows are temporarily unavailable.") : t("shows.none")}
              </p>
              <a
                href="#join"
                onClick={event => {
                  event.preventDefault()
                  document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })
                }}
                class="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200"
              >
                {t("shows.joinCta")} <span aria-hidden="true">→</span>
              </a>
            </div>
          ) : (
            upcoming.map((event, index) => (
              <LiveEventCard
                key={event.id}
                event={event}
                lang={lang}
                index={index}
                labels={{
                  details: lang === "pl" ? "Szczegóły koncertu" : "Show details",
                  tickets: t("shows.tickets"),
                  calendar: lang === "pl" ? "Kalendarz" : "Calendar",
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function Shows({ lang, messages }: Props) {
  return (
    <IslandI18nProvider lang={lang} messages={messages}>
      <ShowsInner lang={lang} />
    </IslandI18nProvider>
  )
}
