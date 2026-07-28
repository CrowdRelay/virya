import { useState, useEffect } from "preact/hooks"
import { IslandI18nProvider, useIslandI18n } from "../../i18n/IslandI18nContext"

const normalizeEvent = (event) => {
  if (!event) return null
  const lineup = Array.isArray(event.lineup) ? event.lineup.join(", ") : ""
  const venue = event.venue ? `${event.venue.name ?? ""}, ${event.venue.city ?? ""}` : ""
  return {
    id: event.id != null ? String(event.id) : null,
    title: lineup && venue ? `${lineup} | ${venue}` : lineup || venue || "Show",
    date: event.datetime || event.starts_at,
    event: event.url || null,
    tickets: event.offers?.find(o => o?.type === "Tickets")?.url ?? event.offers?.[0]?.url ?? null,
    venueName: event.venue?.name ?? null,
    city: [event.venue?.city, event.venue?.country].filter(Boolean).join(", "),
  }
}

const SkeletonRow = () => (
  <div class="border-l-2 border-zinc-700/50 pl-4 py-4 bg-zinc-900/30">
    <div class="h-4 w-2/3 bg-zinc-700/50 animate-pulse mb-2" />
    <div class="h-3 w-1/4 bg-zinc-800/50 animate-pulse" />
  </div>
)

const ShowItem = ({ item, lang }) => {
  const { t, lp } = useIslandI18n()
  const date = new Date(item.date)
  const today = new Date()
  const normalizedDate = new Date(date).setHours(0, 0, 0, 0)
  const normalizedToday = new Date(today).setHours(0, 0, 0, 0)
  if (normalizedDate < normalizedToday) return null

  const isToday = normalizedDate === normalizedToday
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const gigSlug = item.id ? `gig-${item.id}` : null
  const gigPath = gigSlug ? lp(`/shows/${gigSlug}/`) : null

  return (
    <article class={`relative transform ease-in-out rounded-xl inset-0 opacity-75 hover:opacity-100 place-items-center lg:flex lg:flex-row p-2 text-white transition-colors duration-300 ${gigPath ? "border border-amber-400/30 hover:border-amber-400/70" : ""} ${isToday ? "bg-red-900" : "bg-zinc-900/60"}`}>
      <h2 class="lg:text-2xl text-md lg:ml-2">
        {gigPath ? (
          <a href={gigPath} class="hover:text-amber-300 transition-colors">
            <span class="absolute inset-0" aria-hidden="true" />
            {item.title}
          </a>
        ) : item.title}
      </h2>
      <div class="lg:flex lg:flex-row lg:flex-grow place-items-center justify-end">
        <p class="lg:text-2xl lg:my-8 text-md">
          <span>{isToday ? t("shows.today") : t("shows.date")}</span>{" "}
          <time dateTime={item.date}>{date.toLocaleDateString(locale)}</time>
        </p>
        {item.event && (
          <a
            href={item.event}
            rel="noopener noreferrer"
            target="_blank"
            class="relative z-10 inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:px-6 lg:py-4 px-4 py-2 mx-3 lg:mx-6 my-3 lg:my-8 transition duration-500 ease-in-out border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal rounded"
          >
            {t("shows.event")}
          </a>
        )}
        {item.tickets && (
          <a
            href={item.tickets}
            rel="noopener noreferrer"
            target="_blank"
            class="relative z-10 inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:px-6 lg:py-4 px-4 py-2 mx-3 lg:mx-6 my-3 lg:my-8 transition duration-500 ease-in-out border border-amber-300 hover:bg-amber-200 text-amber-300 hover:text-black font-normal rounded"
          >
            {t("shows.tickets")}
          </a>
        )}
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
    const tid = setTimeout(() => controller.abort(), 20000)
    fetch("/api/bandsintown", { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setShows(Array.isArray(data) ? data.map(normalizeEvent).filter(Boolean) : []) })
      .catch(() => { if (!cancelled) setShows([]) })
      .finally(() => { clearTimeout(tid); if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort(); clearTimeout(tid) }
  }, [])

  return (
    <div class="py-16 lg:px-8 border-t border-zinc-800/60">
      <div class="mx-4">
        <div class="flex items-center gap-4 mb-2">
          <p class="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-white">
            {t("shows.heading")}
          </p>
          <div class="flex-1 h-px bg-zinc-800" />
        </div>
        <p class="text-zinc-400 text-xs uppercase tracking-widest mb-8">{t("shows.sub")}</p>
        <div class="flex flex-col gap-1.5">
          {loading ? (
            <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
          ) : shows.length === 0 ? (
            <div class="border-l-2 border-zinc-700 pl-4 py-4">
              <p class="text-zinc-400 text-xs uppercase tracking-widest">{t("shows.none")}</p>
              <a href="#join" onClick={(e) => { e.preventDefault(); document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' }) }} class="inline-flex items-center gap-2 mt-3 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-200 transition-colors">
                {t("shows.joinCta")} <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"><path d="M13 5l6 7-6 7M5 5l6 7-6 7" /></svg>
              </a>
            </div>
          ) : (
            shows.map((item, i) => (
              <ShowItem key={item.id || i} item={item} lang={lang} />
            ))
          )}
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
