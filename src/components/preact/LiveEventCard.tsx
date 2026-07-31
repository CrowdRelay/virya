import type { JSX } from "preact"
import type { Lang } from "../../i18n/t"
import type { PublicEvent } from "../../lib/crowdrelay-client"
import { campaignIdFromLocation, crowdrelay } from "../../lib/crowdrelay"
import { normalizeTicketInventory } from "../../lib/ticketInventory"
import TicketInventoryBar from "./tickets/TicketInventoryBar"

type Labels = {
  details: string
  tickets: string
  calendar: string
  live?: string
  opensNewTab?: string
}

type Props = {
  event: PublicEvent
  lang: Lang
  index: number
  labels: Labels
  campaignId?: string | null
}

type NoticeProps = {
  message: string
  actionLabel?: string
  actionHref?: string
  onAction?: JSX.MouseEventHandler<HTMLAnchorElement>
}

type EventFormatters = {
  day: Intl.DateTimeFormat
  month: Intl.DateTimeFormat
  weekday: Intl.DateTimeFormat
  dateLine: Intl.DateTimeFormat
}

const formatters = new Map<string, EventFormatters>()
const moneyFormatters = new Map<string, Intl.NumberFormat>()

const localizedPath = (lang: Lang, path: string) =>
  lang === "pl" ? `/pl${path}` : path

const isCrowdRelayEvent = (event: PublicEvent) => event.source === "crowdrelay"

const detailsUrl = (event: PublicEvent, lang: Lang) =>
  localizedPath(lang, `/live/${encodeURIComponent(event.slug)}/`)

const eventFormatters = (locale: string): EventFormatters => {
  const cached = formatters.get(locale)
  if (cached) return cached

  const created = {
    day: new Intl.DateTimeFormat(locale, { day: "2-digit" }),
    month: new Intl.DateTimeFormat(locale, { month: "short" }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    dateLine: new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
  formatters.set(locale, created)
  return created
}

const money = (minor: number, currency: string, locale: string) => {
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

const trimPeriod = (value: string) => value.replace(/\.$/, "")

export const LiveEventSkeleton = () => (
  <div class="virya-live-card min-h-56 p-5 sm:p-6" aria-hidden="true">
    <div class="grid animate-pulse gap-6 sm:grid-cols-[80px_minmax(0,1fr)]">
      <div class="h-20 w-20 bg-zinc-800" />
      <div>
        <div class="h-3 w-24 bg-zinc-800" />
        <div class="mt-5 h-6 w-3/4 bg-zinc-800" />
        <div class="mt-4 h-3 w-1/2 bg-zinc-900" />
        <div class="mt-7 h-10 w-44 bg-zinc-900" />
      </div>
    </div>
  </div>
)

export const LiveEventNotice = ({
  message,
  actionLabel,
  actionHref,
  onAction,
}: NoticeProps) => (
  <div class="virya-panel relative overflow-hidden p-6 lg:col-span-2">
    <div class="virya-live-card__rail" aria-hidden="true" />
    <p class="text-xs leading-relaxed text-zinc-400" role="status">
      {message}
    </p>
    {actionLabel && actionHref && (
      <a
        href={actionHref}
        onClick={onAction}
        class="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 transition-colors hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {actionLabel} <span aria-hidden="true">→</span>
      </a>
    )}
  </div>
)

export default function LiveEventCard({ event, lang, index, labels, campaignId }: Props) {
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const date = new Date(event.starts_at)
  if (Number.isNaN(date.getTime())) return null

  const resolvedCampaignId = campaignId ?? campaignIdFromLocation()
  const details = detailsUrl(event, lang)
  const sale = event.ticket_sale ?? null
  const firstPartyTicketHref = sale ? `${details}#tickets` : null
  const externalTicketHref = event.ticket_url
    ? isCrowdRelayEvent(event)
      ? crowdrelay.eventTicketUrl(event.slug, resolvedCampaignId ?? undefined)
      : event.ticket_url
    : null
  const tickets = firstPartyTicketHref ?? externalTicketHref
  const firstPartyTickets = Boolean(firstPartyTicketHref)
  const ticketSaleOpen = sale?.sales_state === "open"
  const calendar = isCrowdRelayEvent(event)
    ? crowdrelay.eventCalendarUrl(event.slug, resolvedCampaignId ?? undefined)
    : null
  const formatter = eventFormatters(locale)
  const day = formatter.day.format(date)
  const month = trimPeriod(formatter.month.format(date))
  const weekday = trimPeriod(formatter.weekday.format(date))
  const dateLine = formatter.dateLine.format(date)
  const location = [event.city?.name, event.venue].filter(Boolean).join(" · ")
  const headingId = `live-event-${event.id.replace(/[^a-z0-9_-]+/gi, "-")}-${index}`
  const opensNewTab =
    labels.opensNewTab ??
    (lang === "pl" ? "Otwiera się w nowej karcie" : "Opens in a new tab")
  const inventory = sale ? normalizeTicketInventory(sale) : null

  const ticketStatus = sale
    ? sale.sales_state === "open"
      ? sale.from_price_gross_minor == null
        ? lang === "pl"
          ? `${inventory?.available ?? sale.available} dostępnych`
          : `${inventory?.available ?? sale.available} available`
        : lang === "pl"
          ? `Od ${money(sale.from_price_gross_minor, sale.currency, locale)} · ${inventory?.available ?? sale.available} dostępnych${inventory?.reserved ? ` · ${inventory.reserved} w płatności` : ""}`
          : `From ${money(sale.from_price_gross_minor, sale.currency, locale)} · ${inventory?.available ?? sale.available} available${inventory?.reserved ? ` · ${inventory.reserved} in payment` : ""}`
      : sale.sales_state === "upcoming"
        ? lang === "pl"
          ? "Sprzedaż wkrótce"
          : "Tickets on sale soon"
        : sale.sales_state === "sold_out"
          ? lang === "pl"
            ? "Pula wyprzedana"
            : "Sold out"
          : lang === "pl"
            ? "Sprzedaż online zakończona"
            : "Online sales closed"
    : null

  return (
    <article class="virya-live-card group" aria-labelledby={headingId}>
      <div class="virya-live-card__rail" aria-hidden="true" />
      <div class="virya-live-card__orbit virya-live-card__orbit--outer" aria-hidden="true" />
      <div class="virya-live-card__orbit virya-live-card__orbit--inner" aria-hidden="true" />
      <span class="virya-live-card__pulse" aria-hidden="true" />

      <div class="relative grid min-h-56 gap-6 p-5 sm:grid-cols-[80px_minmax(0,1fr)] sm:p-6">
        <time dateTime={event.starts_at} class="virya-live-date">
          <span class="text-[8px] font-black uppercase tracking-[.2em] text-amber-400">
            {weekday}
          </span>
          <strong class="mt-1 text-3xl font-black leading-none text-white">{day}</strong>
          <span class="mt-1 text-[8px] font-bold uppercase tracking-[.16em] text-zinc-400">
            {month}
          </span>
        </time>

        <div class="min-w-0">
          <div class="flex items-center justify-between gap-3">
            <span class="font-mono text-[8px] text-zinc-600">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span class="text-[8px] font-black uppercase tracking-[.22em] text-zinc-500">
              {labels.live ?? "VIRYA // LIVE"}
            </span>
          </div>
          <p class="mt-4 font-mono text-[9px] uppercase tracking-[.18em] text-amber-400">
            {dateLine}
          </p>
          <h3
            id={headingId}
            class="mt-3 max-w-xl text-xl font-black uppercase leading-tight text-white transition-colors group-hover:text-amber-400"
          >
            {event.title}
          </h3>
          {location && <p class="mt-3 text-xs leading-relaxed text-zinc-400">{location}</p>}

          {ticketStatus && (
            <div class="mt-5 max-w-xl border border-zinc-800 bg-black/35 px-3 py-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[9px] font-black uppercase tracking-[.18em] text-amber-400">
                  {lang === "pl" ? "Bilety Virya" : "Virya tickets"}
                </span>
                <span class="text-[10px] font-bold text-zinc-200">{ticketStatus}</span>
              </div>
              {sale && sale.sales_state === "open" && (
                <TicketInventoryBar
                  inventory={sale}
                  lang={lang}
                  compact
                  showLegend={false}
                  class="mt-2"
                />
              )}
            </div>
          )}

          <div class="relative z-10 mt-6 flex flex-wrap gap-2">
            {tickets && (ticketSaleOpen || !firstPartyTickets) && (
              <a
                href={tickets}
                target={firstPartyTickets ? undefined : "_blank"}
                rel={firstPartyTickets ? undefined : "noopener noreferrer"}
                class="virya-button virya-button--primary"
              >
                {labels.tickets}
                <span class="ml-2" aria-hidden="true">{firstPartyTickets ? "→" : "↗"}</span>
                {!firstPartyTickets && <span class="sr-only">. {opensNewTab}</span>}
              </a>
            )}
            <a
              href={details}
              class={`virya-button ${ticketSaleOpen ? "virya-button--secondary" : "virya-button--primary"}`}
            >
              {labels.details}
              <span class="ml-2" aria-hidden="true">→</span>
            </a>
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
