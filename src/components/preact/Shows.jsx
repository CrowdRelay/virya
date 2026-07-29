import { useEffect, useMemo, useState } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"

const normalizeEvent = (event) => {
  if (!event) return null

  const lineup = Array.isArray(event.lineup) ? event.lineup.filter(Boolean) : []
  const venueName = event.venue?.name ?? null
  const city = [event.venue?.city, event.venue?.country].filter(Boolean).join(", ")
  const title = lineup.length > 0
    ? lineup.join(" · ")
    : event.title || venueName || "Virya live"

  return {
    id: event.id != null ? String(event.id) : null,
    title,
    date: event.datetime || event.starts_at || null,
    event: event.url || event.external_event_url || null,
    tickets:
      event.offers?.find((offer) => offer?.type === "Tickets" && offer?.url)?.url
      || event.offers?.find((offer) => offer?.url)?.url
      || event.ticket_url
      || null,
    venueName,
    city,
  }
}

const loadShows = async (signal) => {
  const response = await fetch("/api/bandsintown", {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!response.ok) return []

  const data = await response.json()
  return Array.isArray(data)
    ? data.map(normalizeEvent).filter(Boolean)
    : []
}

const SkeletonRow = () => (
  <div class="relative overflow-hidden border border-zinc-800 bg-zinc-950/80 px-4 py-5 sm:px-5">
    <div class="absolute inset-y-0 left-0 w-1 bg-zinc-700" />
    <div class="ml-2 flex items-center gap-4">
      <div class="h-14 w-14 shrink-0 animate-pulse bg-zinc-800" />
      <div class="min-w-0 flex-1">
        <div class="h-4 w-2/3 animate-pulse bg-zinc-800" />
        <div class="mt-3 h-3 w-1/3 animate-pulse bg-zinc-900" />
      </div>
    </div>
  </div>
)

const ShowItem = ({ item, lang }) => {
  const { t, lp } = useIslandI18n()
  const date = new Date(item.date)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  const normalizedDate = new Date(date).setHours(0, 0, 0, 0)
  const normalizedToday = new Date(today).setHours(0, 0, 0, 0)
  if (normalizedDate < normalizedToday) return null

  const isToday = normalizedDate === normalizedToday
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const detailsPath = item.id ? lp(`/shows/gig-${item.id}/`) : null
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date)
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "")
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date)
  const venueLine = [item.venueName, item.city].filter(Boolean).join(" · ")

  return (
    <article class={`group relative overflow-hidden border bg-zinc-950/85 transition-colors duration-300 ${isToday ? "border-amber-400/80" : "border-zinc-800 hover:border-amber-400/55"}`}>
      <div class={`absolute inset-y-0 left-0 w-1 ${isToday ? "bg-amber-400" : "bg-zinc-700 transition-colors group-hover:bg-amber-400"}`} aria-hidden="true" />

      <div class="grid gap-4 px-4 py-5 sm:grid-cols-[68px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <time dateTime={item.date} class="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center border border-zinc-800 bg-black/45 text-center">
          <strong class="text-2xl font-black leading-none text-white">{day}</strong>
          <span class="mt-1 text-[9px] font-black uppercase tracking-[.18em] text-amber-400">{month}</span>
          <span class="mt-0.5 text-[8px] font-bold text-zinc-500">{year}</span>
        </time>

        <div class="min-w-0">
          {isToday && (
            <span class="mb-2 inline-flex text-[8px] font-black uppercase tracking-[.2em] text-amber-400">
              {t("shows.today").replace(" - ", "")}
            </span>
          )}
          <h3 class="text-lg font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover:text-amber-400 sm:text-xl">
            {detailsPath ? <a href={detailsPath}>{item.title}</a> : item.title}
          </h3>
          {venueLine && <p class="mt-2 text-xs leading-relaxed text-zinc-400">{venueLine}</p>}
        </div>

        <div class="flex flex-wrap gap-2 sm:max-w-44 sm:justify-end">
          {detailsPath && (
            <a href={detailsPath} class="inline-flex min-h-11 items-center justify-center bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black transition-colors hover:bg-amber-300">
              {lang === "pl" ? "Szczegóły" : "Details"}<span class="ml-2" aria-hidden="true">→</span>
            </a>
          )}
          {item.tickets && (
            <a href={item.tickets} rel="noopener noreferrer" target="_blank" class="inline-flex min-h-11 items-center justify-center border border-amber-400/60 px-4 text-[9px] font-black uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-400 hover:text-black">
              {t("shows.tickets")}<span class="ml-2" aria-hidden="true">↗</span>
            </a>
          )}
          {!detailsPath && item.event && (
            <a href={item.event} rel="noopener noreferrer" target="_blank" class="inline-flex min-h-11 items-center justify-center border border-zinc-700 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-400 hover:text-amber-400">
              {t("shows.event")}<span class="ml-2" aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

const ShowsInner = ({ lang }) => {
  const { t } = useIslandI18n()
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    loadShows(controller.signal)
      .then((data) => {
        if (!cancelled) setShows(data)
      })
      .catch(() => {
        if (!cancelled) setShows([])
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [])

  const upcoming = useMemo(
    () => shows
      .filter((show) => {
        const date = new Date(show.date)
        return !Number.isNaN(date.getTime())
          && date.getTime() >= new Date().setHours(0, 0, 0, 0)
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()),
    [shows],
  )

  return (
    <div class="border-t border-zinc-800/60 py-16 lg:px-8" aria-labelledby="shows-heading">
      <div class="mx-4">
        <div class="mb-2 flex items-center gap-4">
          <h2 id="shows-heading" class="text-3xl font-black uppercase tracking-widest text-white sm:whitespace-nowrap">{t("shows.heading")}</h2>
          <div class="h-px flex-1 bg-zinc-800" />
        </div>
        <p class="mb-8 text-xs uppercase tracking-widest text-zinc-400">{t("shows.sub")}</p>

        <div class="grid gap-2">
          {loading ? (
            <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
          ) : upcoming.length === 0 ? (
            <div class="relative overflow-hidden border border-zinc-800 bg-zinc-950 px-6 py-8">
              <div class="absolute inset-y-0 left-0 w-1 bg-zinc-700" />
              <p class="text-xs uppercase tracking-widest text-zinc-400">{t("shows.none")}</p>
              <a href="#join" onClick={(event) => { event.preventDefault(); document.getElementById("join")?.scrollIntoView({ behavior: "smooth" }) }} class="group mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 transition-colors hover:text-amber-200">
                {t("shows.joinCta")} <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </a>
            </div>
          ) : upcoming.map((item, index) => (
            <ShowItem key={item.id || index} item={item} lang={lang} />
          ))}
        </div>
      </div>
    </div>
  )
}

const Shows = ({ lang, messages }) => (
  <IslandI18nProvider lang={lang} messages={messages}>
    <ShowsInner lang={lang} />
  </IslandI18nProvider>
)

export default Shows
