import type { Lang } from "../../i18n/t"
import type { PublicEvent } from "../../lib/crowdrelay-client"
import { campaignIdFromLocation, crowdrelay } from "../../lib/crowdrelay"

type Labels = {
  details: string
  tickets: string
  calendar: string
  live?: string
}

type Props = {
  event: PublicEvent
  lang: Lang
  index: number
  labels: Labels
  campaignId?: string | null
}

const localizedPath = (lang: Lang, path: string) =>
  lang === "pl" ? `/pl${path}` : path

const isCrowdRelayEvent = (event: PublicEvent) => event.source === "crowdrelay"

const detailsUrl = (event: PublicEvent, lang: Lang) => {
  if (isCrowdRelayEvent(event)) return localizedPath(lang, `/live/${event.slug}/`)
  if (event.source === "bandsintown") return localizedPath(lang, `/shows/${event.slug}/`)
  return event.external_event_url
}

export default function LiveEventCard({ event, lang, index, labels, campaignId }: Props) {
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const date = new Date(event.starts_at)
  if (Number.isNaN(date.getTime())) return null

  const resolvedCampaignId = campaignId ?? campaignIdFromLocation()
  const details = detailsUrl(event, lang)
  const tickets = isCrowdRelayEvent(event) && event.ticket_url
    ? crowdrelay.eventTicketUrl(event.slug, resolvedCampaignId ?? undefined)
    : event.ticket_url
  const calendar = isCrowdRelayEvent(event)
    ? crowdrelay.eventCalendarUrl(event.slug, resolvedCampaignId ?? undefined)
    : null
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date)
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "")
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", "")
  const dateLine = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
  const externalDetails = !isCrowdRelayEvent(event)
  const location = [event.city?.name, event.venue].filter(Boolean).join(" · ")

  return (
    <article class="virya-live-card group">
      <div class="virya-live-card__rail" aria-hidden="true" />
      <div class="virya-live-card__orbit virya-live-card__orbit--outer" aria-hidden="true" />
      <div class="virya-live-card__orbit virya-live-card__orbit--inner" aria-hidden="true" />
      <span class="virya-live-card__pulse" aria-hidden="true" />

      <div class="relative grid min-h-52 gap-6 p-5 sm:grid-cols-[80px_minmax(0,1fr)] sm:p-6">
        <time dateTime={event.starts_at} class="virya-live-date">
          <span class="text-[8px] font-black uppercase tracking-[.2em] text-amber-400">{weekday}</span>
          <strong class="mt-1 text-3xl font-black leading-none text-white">{day}</strong>
          <span class="mt-1 text-[8px] font-bold uppercase tracking-[.16em] text-zinc-400">{month}</span>
        </time>

        <div class="min-w-0">
          <div class="flex items-center justify-between gap-3">
            <span class="font-mono text-[8px] text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
            <span class="text-[8px] font-black uppercase tracking-[.22em] text-zinc-500">{labels.live ?? "VIRYA // LIVE"}</span>
          </div>
          <p class="mt-4 font-mono text-[9px] uppercase tracking-[.18em] text-amber-400">{dateLine}</p>
          <h3 class="mt-3 max-w-xl text-xl font-black uppercase leading-tight text-white transition-colors group-hover:text-amber-400">
            {event.title}
          </h3>
          {location && <p class="mt-3 text-xs leading-relaxed text-zinc-400">{location}</p>}
          <div class="relative z-10 mt-6 flex flex-wrap gap-2">
            {details && (
              <a
                href={details}
                target={externalDetails ? "_blank" : undefined}
                rel={externalDetails ? "noopener noreferrer" : undefined}
                class="virya-button virya-button--primary"
              >
                {labels.details}<span class="ml-2" aria-hidden="true">{externalDetails ? "↗" : "→"}</span>
              </a>
            )}
            {tickets && (
              <a
                href={tickets}
                target="_blank"
                rel="noopener noreferrer"
                class="virya-button virya-button--accent-outline"
              >
                {labels.tickets}<span class="ml-2" aria-hidden="true">↗</span>
              </a>
            )}
            {calendar && (
              <a href={calendar} class="virya-button virya-button--ghost">
                {labels.calendar}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
