import { useEffect, useMemo, useState } from "preact/hooks"
import type { Lang } from "../../i18n/t"
import type { PublicEvent } from "../../lib/crowdrelay-client"
import { campaignIdFromLocation } from "../../lib/crowdrelay"
import { loadLiveEvents, upcomingLiveEvents } from "../../lib/liveEvents"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"
import LiveEventCard, { LiveEventNotice, LiveEventSkeleton } from "./LiveEventCard"

type Props = {
  lang: Lang
  messages: Record<string, string>
}

const ShowsInner = ({ lang }: { lang: Lang }) => {
  const { t } = useIslandI18n()
  const [events, setEvents] = useState<PublicEvent[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const campaignId = useMemo(() => campaignIdFromLocation(), [])

  useEffect(() => {
    const controller = new AbortController()

    void loadLiveEvents(controller.signal)
      .then(items => {
        setEvents(items)
        setUnavailable(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setEvents([])
        setUnavailable(true)
      })

    return () => controller.abort()
  }, [])

  const upcoming = useMemo(() => upcomingLiveEvents(events ?? []), [events])
  const unavailableMessage =
    lang === "pl"
      ? "Koncerty są chwilowo niedostępne."
      : "Shows are temporarily unavailable."

  return (
    <section class="virya-section border-t border-zinc-800/60" aria-labelledby="shows-heading">
      <div class="virya-section__inner">
        <div class="max-w-3xl">
          <p class="virya-eyebrow">VIRYA // LIVE</p>
          <h2 id="shows-heading" class="virya-heading mt-4">{t("shows.heading")}</h2>
          <p class="virya-copy mt-5">{t("shows.sub")}</p>
        </div>

        <div class="mt-10 grid gap-4 lg:grid-cols-2">
          {events === null ? (
            <>
              <LiveEventSkeleton />
              <LiveEventSkeleton />
            </>
          ) : upcoming.length === 0 ? (
            <LiveEventNotice
              message={unavailable ? unavailableMessage : t("shows.none")}
              actionHref="#join"
              actionLabel={t("shows.joinCta")}
              onAction={event => {
                event.preventDefault()
                document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })
              }}
            />
          ) : (
            upcoming.map((event, index) => (
              <LiveEventCard
                key={event.id}
                event={event}
                lang={lang}
                index={index}
                campaignId={campaignId}
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
    </section>
  )
}

export default function Shows({ lang, messages }: Props) {
  return (
    <IslandI18nProvider lang={lang} messages={messages}>
      <ShowsInner lang={lang} />
    </IslandI18nProvider>
  )
}
