import { useEffect, useMemo, useState } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"
import { crowdrelay } from "../../lib/crowdrelay"

const normalizeEvent = (event, source = "bandsintown") => {
  if (!event) return null
  const lineup = Array.isArray(event.lineup) ? event.lineup.filter(Boolean) : []
  const crowdRelayEvent = source === "crowdrelay"
  const venueName = crowdRelayEvent
    ? (typeof event.venue === "string" ? event.venue : null)
    : (event.venue?.name ?? null)
  const city = crowdRelayEvent
    ? [event.city?.name, event.city?.country_code].filter(Boolean).join(", ")
    : [event.venue?.city, event.venue?.country].filter(Boolean).join(", ")
  const title = event.title || (lineup.length > 0 ? lineup.join(" · ") : venueName || "Virya live")

  return {
    id: event.id != null ? String(event.id) : null,
    slug: typeof event.slug === "string" ? event.slug : null,
    source,
    title,
    date: event.datetime || event.starts_at,
    event: event.external_event_url || event.url || null,
    tickets: event.ticket_url
      || event.offers?.find((offer) => offer?.type === "Tickets")?.url
      || event.offers?.find((offer) => offer?.url)?.url
      || null,
    venueName,
    city,
  }
}

const loadShows = async (signal) => {
  try {
    const events = await crowdrelay.listEvents(50)
    if (events.length > 0) {
      return events.map((event) => normalizeEvent(event, "crowdrelay")).filter(Boolean)
    }
  } catch {
    // The synchronized CrowdRelay calendar is primary; Bandsintown stays a fallback.
  }

  const response = await fetch("/api/bandsintown", { signal })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data)
    ? data.map((event) => normalizeEvent(event, "bandsintown")).filter(Boolean)
    : []
}


const SkeletonCard = () => (
  <div class="relative min-h-44 overflow-hidden border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
    <div class="absolute inset-y-0 left-0 w-1 bg-zinc-700" />
    <div class="ml-3 h-3 w-28 animate-pulse bg-zinc-800" />
    <div class="ml-3 mt-5 h-7 w-4/5 animate-pulse bg-zinc-800/80" />
    <div class="ml-3 mt-4 h-3 w-1/2 animate-pulse bg-zinc-900" />
  </div>
)

const ShowItem = ({ item, lang, index }) => {
  const { t, lp } = useIslandI18n()
  const date = new Date(item.date)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  const normalizedDate = new Date(date).setHours(0, 0, 0, 0)
  const normalizedToday = new Date(today).setHours(0, 0, 0, 0)
  if (normalizedDate < normalizedToday) return null

  const isToday = normalizedDate === normalizedToday
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const detailsPath = item.source === "crowdrelay" && item.slug
    ? lp(`/live/${item.slug}/`)
    : item.id
      ? lp(`/shows/gig-${item.id}/`)
      : null
  const primaryHref = detailsPath || item.event || item.tickets

  const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date)
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "")
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", "")
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date)

  return (
    <article class={`group relative isolate overflow-hidden border bg-zinc-950 transition-all duration-300 ${isToday ? "border-amber-400/80" : "border-zinc-800 hover:border-amber-400/55"}`}>
      <div class={`absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-2 ${isToday ? "bg-amber-400" : "bg-zinc-700 group-hover:bg-amber-400"}`} aria-hidden="true" />
      <div class="absolute -right-14 -top-20 h-48 w-48 rounded-full border border-amber-400/10 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
      <div class="relative grid min-h-48 gap-6 px-5 py-6 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center sm:px-7">
        <time dateTime={item.date} class="flex w-fit min-w-[78px] flex-col border border-zinc-800 bg-black/50 px-3 py-3 text-center transition-colors group-hover:border-amber-400/40">
          <span class="text-[9px] font-black uppercase tracking-[.22em] text-amber-400">{isToday ? t("shows.today").replace(" - ", "") : weekday}</span>
          <strong class="mt-1 text-4xl font-black leading-none text-white">{day}</strong>
          <span class="mt-1 text-[9px] font-bold uppercase tracking-[.18em] text-zinc-400">{month} {year}</span>
        </time>

        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <span class="font-mono text-[8px] text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
            <span class="text-[8px] font-black uppercase tracking-[.24em] text-zinc-500">VIRYA // LIVE</span>
          </div>
          <h2 class="mt-4 text-xl font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover:text-amber-400 sm:text-2xl">
            {primaryHref ? <a href={primaryHref}>{item.title}</a> : item.title}
          </h2>
          <p class="mt-3 text-xs leading-relaxed text-zinc-400">
            {[item.venueName, item.city].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div class="relative z-10 flex flex-wrap gap-2 sm:max-w-44 sm:flex-col">
          {detailsPath && (
            <a href={detailsPath} class="inline-flex min-h-11 items-center justify-center bg-amber-400 px-5 text-[9px] font-black uppercase tracking-widest text-black transition-colors hover:bg-amber-300">
              {lang === "pl" ? "Szczegóły" : "Details"}<span class="ml-2" aria-hidden="true">→</span>
            </a>
          )}
          {item.tickets && (
            <a href={item.tickets} rel="noopener noreferrer" target="_blank" class="inline-flex min-h-11 items-center justify-center border border-amber-400/60 px-5 text-[9px] font-black uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-400 hover:text-black">
              {t("shows.tickets")}<span class="ml-2" aria-hidden="true">↗</span>
            </a>
          )}
          {!detailsPath && item.event && (
            <a href={item.event} rel="noopener noreferrer" target="_blank" class="inline-flex min-h-11 items-center justify-center border border-zinc-700 px-5 text-[9px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-400 hover:text-amber-400">
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
      .catch(() => { if (!cancelled) setShows([]) })
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
      .filter((show) => new Date(show.date).getTime() >= new Date().setHours(0, 0, 0, 0))
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()),
    [shows],
  )

  return (
    <section class="border-t border-zinc-800/60 py-16 lg:px-8" aria-labelledby="shows-heading">
      <div class="mx-4">
        <div class="flex items-center gap-4 mb-2">
          <h2 id="shows-heading" class="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">{t("shows.heading")}</h2>
          <div class="h-px flex-1 bg-zinc-800" />
        </div>
        <p class="mb-8 text-xs uppercase tracking-widest text-zinc-400">{t("shows.sub")}</p>
        <div class="grid gap-3">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : upcoming.length === 0 ? (
            <div class="relative overflow-hidden border border-zinc-800 bg-zinc-950 px-6 py-8">
              <div class="absolute inset-y-0 left-0 w-1 bg-zinc-700" />
              <p class="text-xs uppercase tracking-widest text-zinc-400">{t("shows.none")}</p>
              <a href="#join" onClick={(event) => { event.preventDefault(); document.getElementById("join")?.scrollIntoView({ behavior: "smooth" }) }} class="group mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 transition-colors hover:text-amber-200">
                {t("shows.joinCta")} <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </a>
            </div>
          ) : upcoming.map((item, index) => (
            <ShowItem key={item.id || index} item={item} lang={lang} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

const Shows = ({ lang, messages }) => (
  <IslandI18nProvider lang={lang} messages={messages}>
    <ShowsInner lang={lang} />
  </IslandI18nProvider>
)

export default Shows
