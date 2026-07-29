import { useEffect, useMemo, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type {
  CitySignal,
  PublicEvent,
} from "../../../lib/crowdrelay-client"
import {
  campaignIdFromLocation,
  crowdrelay,
  referralCodeFromLocation,
  rememberSignalCity,
  signalCityFromLocation,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
}

type SubmitState = "idle" | "saving" | "pending" | "saved" | "error"

type CacheEntry<T> = {
  storedAt: number
  value: T
}

const CACHE_TTL_MS = 5 * 60 * 1000

const signalDotSize = (fanCount: number): number =>
  Math.min(18, 6 + Math.floor(Math.max(0, fanCount) / 10))

type BandsintownEvent = {
  id?: string | number
  datetime?: string
  url?: string
  lineup?: string[]
  venue?: {
    name?: string
    city?: string
    region?: string
    country?: string
  }
  offers?: Array<{ type?: string; url?: string }>
}

const countryCode = (country?: string): string => {
  const normalized = country?.trim().toLowerCase()
  if (!normalized) return "--"
  const known: Record<string, string> = {
    poland: "PL",
    polska: "PL",
    germany: "DE",
    deutschland: "DE",
    czechia: "CZ",
    "czech republic": "CZ",
    slovakia: "SK",
    austria: "AT",
    hungary: "HU",
    lithuania: "LT",
    latvia: "LV",
    estonia: "EE",
    netherlands: "NL",
    belgium: "BE",
    france: "FR",
    italy: "IT",
    spain: "ES",
    portugal: "PT",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    ireland: "IE",
    "united kingdom": "GB",
    uk: "GB",
    "united states": "US",
    usa: "US",
    canada: "CA",
  }
  if (known[normalized]) return known[normalized]
  return /^[a-z]{2}$/.test(normalized) ? normalized.toUpperCase() : "--"
}

function normalizeBandsintownEvent(event: BandsintownEvent): PublicEvent | null {
  const startsAt = event.datetime
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return null

  const externalId = event.id == null ? `${startsAt}-${event.venue?.city ?? "show"}` : String(event.id)
  const venueName = event.venue?.name?.trim() || null
  const cityName = event.venue?.city?.trim() || null
  const lineup = Array.isArray(event.lineup) ? event.lineup.filter(Boolean) : []
  const title = lineup.length > 0 ? lineup.join(" · ") : venueName || "Virya live"
  const ticketUrl = event.offers?.find(offer => offer?.type === "Tickets")?.url
    ?? event.offers?.find(offer => offer?.url)?.url
    ?? null

  return {
    id: `bandsintown:${externalId}`,
    slug: `gig-${externalId}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
    title,
    description: null,
    city: cityName ? {
      id: `bandsintown-city:${cityName.toLowerCase()}`,
      slug: cityName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: cityName,
      country_code: countryCode(event.venue?.country),
      region: event.venue?.region ?? null,
    } : null,
    venue: venueName,
    venue_address: null,
    timezone: "Europe/Warsaw",
    starts_at: startsAt,
    doors_at: null,
    ends_at: null,
    ticket_url: ticketUrl,
    listen_url: null,
    image_url: null,
    trailer_url: null,
    external_event_url: event.url ?? ticketUrl,
    updated_at: new Date().toISOString(),
  }
}

async function loadBandsintownEvents(): Promise<PublicEvent[]> {
  const response = await fetch("/api/bandsintown", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6_000),
  })
  if (!response.ok) return []
  const payload = await response.json()
  if (!Array.isArray(payload)) return []
  return payload
    .map(item => normalizeBandsintownEvent(item as BandsintownEvent))
    .filter((item): item is PublicEvent => item !== null)
}

export default function SignalHub({ lang }: Props) {
  const copy = SIGNAL_COPY[lang]
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [cities, setCities] = useState<CitySignal[] | null>(null)
  const [cityError, setCityError] = useState(false)
  const [events, setEvents] = useState<PublicEvent[] | null>(null)
  const [eventError, setEventError] = useState(false)
  const [selectedCity, setSelectedCity] = useState("")
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [submitMessage, setSubmitMessage] = useState("")
  const [referralUrl, setReferralUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const rememberedCity = signalCityFromLocation()
    if (rememberedCity) setSelectedCity(rememberedCity)

    let cancelled = false
    const cachedCities = readCache<CitySignal[]>("virya-signal-cities-v1")
    const cachedEvents = readCache<PublicEvent[]>("virya-signal-events-v1")
    if (cachedCities) setCities(cachedCities)
    if (cachedEvents) setEvents(cachedEvents)

    void crowdrelay
      .listCities(100)
      .then(items => {
        if (cancelled) return
        setCities(items)
        setCityError(false)
        setSelectedCity(current =>
          current && items.some(city => city.slug === current) ? current : "",
        )
        writeCache("virya-signal-cities-v1", items)
      })
      .catch(() => {
        if (cancelled) return
        setCityError(true)
        setCities(current => current ?? [])
      })

    void (async () => {
      try {
        const crowdRelayEvents = await crowdrelay.listEvents(20)
        if (cancelled) return
        if (crowdRelayEvents.length > 0) {
          setEvents(crowdRelayEvents)
          setEventError(false)
          writeCache("virya-signal-events-v1", crowdRelayEvents)
          return
        }

        const fallbackEvents = await loadBandsintownEvents()
        if (cancelled) return
        setEvents(fallbackEvents)
        setEventError(false)
        writeCache("virya-signal-events-v1", fallbackEvents)
      } catch {
        try {
          const fallbackEvents = await loadBandsintownEvents()
          if (cancelled) return
          setEvents(fallbackEvents)
          setEventError(fallbackEvents.length === 0)
          if (fallbackEvents.length > 0) {
            writeCache("virya-signal-events-v1", fallbackEvents)
          }
        } catch {
          if (cancelled) return
          setEventError(true)
          setEvents(current => current ?? [])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const rankedCities = useMemo(
    () =>
      [...(cities ?? [])]
        .sort((left, right) =>
          right.fan_count === left.fan_count
            ? left.name.localeCompare(right.name, locale)
            : right.fan_count - left.fan_count,
        )
        .slice(0, 12),
    [cities, locale],
  )

  const upcomingEvents = useMemo(
    () =>
      [...(events ?? [])]
        .filter(event => new Date(event.starts_at).getTime() > Date.now() - 86_400_000)
        .sort(
          (left, right) =>
            new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
        )
        .slice(0, 6),
    [events],
  )

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const email = String(data.get("email") ?? "").trim()
    const citySlug = String(data.get("city") ?? "").trim()
    const displayName = String(data.get("display_name") ?? "").trim()
    const consent = data.get("consent") === "on"

    if (!email || !citySlug || !consent) {
      setSubmitState("error")
      setSubmitMessage(copy.form.validationError)
      return
    }

    setSubmitState("saving")
    setSubmitMessage("")
    setReferralUrl(null)
    setCopied(false)

    try {
      const campaignId = campaignIdFromLocation()
      const referralCode = referralCodeFromLocation()
      const result = await crowdrelay.signupFan({
        email,
        city_slug: citySlug,
        ...(displayName ? { display_name: displayName } : {}),
        ...(campaignId ? { campaign_id: campaignId } : {}),
        ...(referralCode ? { referral_code: referralCode } : {}),
        locale,
        consent: {
          marketing: true,
          policy_version: "virya-signal-v1",
        },
      })

      rememberSignalCity(citySlug)
      setSelectedCity(citySlug)
      setReferralUrl(result.referral_url)
      if (result.confirmation_required) {
        setSubmitState("pending")
        setSubmitMessage(copy.form.pendingBody)
      } else {
        setSubmitState("saved")
        setSubmitMessage(copy.form.savedBody)
      }
      form.reset()
      setSelectedCity(citySlug)
    } catch {
      setSubmitState("error")
      setSubmitMessage(copy.form.saveError)
    }
  }

  async function copyReferral() {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <section
        id="join-signal"
        class="scroll-mt-24 border-y border-zinc-800/60 bg-black/30 px-4 py-16 sm:px-6 lg:px-12 lg:py-24"
      >
        <div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:gap-16">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[.35em] text-amber-400">
              {copy.form.eyebrow}
            </p>
            <h2 class="mt-4 text-[clamp(2.2rem,8vw,4.5rem)] font-black uppercase leading-[.92] tracking-[-.04em] text-white">
              {copy.form.heading}
            </h2>
            <p class="mt-6 max-w-xl text-sm leading-relaxed text-zinc-300 text-justify mobile-justify lg:text-base">
              {copy.form.body}
            </p>
            <div class="mt-8 grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {copy.teaser.chips.slice(0, 3).map((chip, index) => (
                <div class="bg-zinc-950 p-4" key={chip}>
                  <span class="font-mono text-[8px] text-amber-400">0{index + 1}</span>
                  <p class="mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-300">
                    {chip}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div class="border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl sm:p-7 lg:p-8">
            <form onSubmit={submit} noValidate>
              <div class="grid gap-5 sm:grid-cols-2">
                <label class="block sm:col-span-2">
                  <span class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-400">
                    {copy.form.email}
                  </span>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    class="mt-2 min-h-[50px] w-full border border-zinc-700 bg-zinc-900 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400"
                  />
                </label>

                <label class="block">
                  <span class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-400">
                    {copy.form.nickname}
                  </span>
                  <input
                    name="display_name"
                    type="text"
                    autoComplete="nickname"
                    maxLength={160}
                    class="mt-2 min-h-[50px] w-full border border-zinc-700 bg-zinc-900 px-4 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400"
                  />
                </label>

                <label class="block">
                  <span class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-400">
                    {copy.form.city}
                  </span>
                  <select
                    name="city"
                    required
                    value={selectedCity}
                    onChange={event =>
                      setSelectedCity((event.currentTarget as HTMLSelectElement).value)
                    }
                    disabled={cities === null || submitState === "saving"}
                    class="mt-2 min-h-[50px] w-full border border-zinc-700 bg-zinc-900 px-4 text-sm text-white focus:border-amber-400 disabled:opacity-60"
                  >
                    <option value="">
                      {cities === null
                        ? copy.form.loadingCities
                        : copy.form.cityPlaceholder}
                    </option>
                    {(cities ?? []).map(city => (
                      <option value={city.slug} key={city.slug}>
                        {city.name}
                        {city.fan_count > 0 ? ` · ${city.fan_count}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label class="mt-6 flex cursor-pointer items-start gap-3 border-l-2 border-amber-400/50 bg-amber-400/[.035] p-4">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  class="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
                />
                <span class="text-xs leading-relaxed text-zinc-300">
                  {copy.form.consent}
                </span>
              </label>

              <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={cities === null || submitState === "saving"}
                  class="inline-flex min-h-[50px] items-center justify-center bg-amber-400 px-6 text-[10px] font-black uppercase tracking-widest text-black transition-colors hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50"
                >
                  {submitState === "saving" ? copy.form.saving : copy.form.submit}
                  <span class="ml-3" aria-hidden="true">→</span>
                </button>
                <p class="max-w-sm text-[9px] leading-relaxed text-zinc-500">
                  {copy.form.privacy}
                </p>
              </div>
            </form>

            {cityError && (
              <p class="mt-5 text-xs font-semibold text-amber-400" role="status">
                {copy.form.loadError}
              </p>
            )}

            {submitState !== "idle" && submitState !== "saving" && (
              <div
                class={`mt-6 border p-5 ${
                  submitState === "error"
                    ? "border-red-400/40 bg-red-400/[.04]"
                    : "border-amber-400/40 bg-amber-400/[.04]"
                }`}
                role="status"
                aria-live="polite"
              >
                <p class="text-xs font-black uppercase tracking-widest text-white">
                  {submitState === "pending"
                    ? copy.form.pendingTitle
                    : submitState === "saved"
                      ? copy.form.savedTitle
                      : copy.form.saveError}
                </p>
                <p class="mt-2 text-xs leading-relaxed text-zinc-300">
                  {submitMessage}
                </p>
                {(referralUrl || submitState === "saved") && (
                  <div class="mt-5 flex flex-wrap gap-3">
                    {referralUrl && (
                      <button
                        type="button"
                        onClick={copyReferral}
                        class="inline-flex min-h-[44px] items-center border border-zinc-700 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-200 hover:border-amber-400 hover:text-amber-400"
                      >
                        {copied ? copy.form.copied : copy.form.copy}
                      </button>
                    )}
                    <a
                      href={pagePath(lang, "/my-signal/")}
                      class="inline-flex min-h-[44px] items-center bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300"
                    >
                      {copy.form.goAccount}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="signal-cities"
        class="signal-deferred scroll-mt-24 px-4 py-16 sm:px-6 lg:px-12 lg:py-24"
      >
        <div class="mx-auto max-w-7xl">
          <div class="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[.35em] text-amber-400">
                {copy.cities.eyebrow}
              </p>
              <h2 class="mt-4 text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl lg:text-5xl">
                {copy.cities.heading}
              </h2>
              <p class="mt-5 text-sm leading-relaxed text-zinc-400 text-justify mobile-justify">
                {copy.cities.body}
              </p>
            </div>

            <div class="grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
              {cities === null && (
                <p class="bg-zinc-950 p-6 text-xs text-zinc-400 sm:col-span-2" aria-busy="true">
                  {copy.cities.loading}
                </p>
              )}
              {cities !== null && rankedCities.length === 0 && (
                <p class="bg-zinc-950 p-6 text-xs text-zinc-400 sm:col-span-2">
                  {cityError ? copy.cities.unavailable : copy.cities.empty}
                </p>
              )}
              {rankedCities.map((city, index) => (
                <button
                  type="button"
                  key={city.slug}
                  onClick={() => {
                    setSelectedCity(city.slug)
                    rememberSignalCity(city.slug)
                    document
                      .getElementById("join-signal")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }}
                  class="group flex min-h-[92px] items-center justify-between bg-zinc-950 p-4 text-left transition-colors hover:bg-zinc-900"
                >
                  <span>
                    <span class="font-mono text-[8px] text-zinc-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span class="mt-2 block text-sm font-black uppercase tracking-widest text-white group-hover:text-amber-400">
                      {city.name}
                    </span>
                    <span class="mt-1 block text-[9px] uppercase tracking-widest text-zinc-500">
                      {city.country_code}
                    </span>
                  </span>
                  <span class="text-right">
                    <span class="flex items-center justify-end gap-3">
                      {city.fan_count > 0 && (
                        <span
                          class="relative inline-flex shrink-0 items-center justify-center"
                          style={{
                            width: `${signalDotSize(city.fan_count)}px`,
                            height: `${signalDotSize(city.fan_count)}px`,
                          }}
                          aria-hidden="true"
                        >
                          <span class="absolute inset-0 rounded-full bg-amber-400/35 motion-safe:animate-ping"></span>
                          <span class="relative h-full w-full rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,.82)] motion-safe:animate-pulse"></span>
                        </span>
                      )}
                      <strong class="block text-xl font-black text-amber-400">
                        {city.fan_count}
                      </strong>
                    </span>
                    <span class="text-[8px] uppercase tracking-widest text-zinc-500">
                      {copy.cities.people(city.fan_count)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="signal-shows"
        class="signal-deferred scroll-mt-24 border-t border-zinc-800/60 bg-black/30 px-4 py-16 sm:px-6 lg:px-12 lg:py-24"
      >
        <div class="mx-auto max-w-7xl">
          <div class="max-w-3xl">
            <p class="text-[10px] font-black uppercase tracking-[.35em] text-amber-400">
              {copy.events.eyebrow}
            </p>
            <h2 class="mt-4 text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl lg:text-5xl">
              {copy.events.heading}
            </h2>
            <p class="mt-5 text-sm leading-relaxed text-zinc-400 text-justify mobile-justify">
              {copy.events.body}
            </p>
          </div>

          <div class="mt-10 grid gap-4 lg:grid-cols-2">
            {events === null && (
              <p class="border border-zinc-800 bg-zinc-950 p-6 text-xs text-zinc-400 lg:col-span-2" aria-busy="true">
                {copy.events.loading}
              </p>
            )}
            {events !== null && upcomingEvents.length === 0 && (
              <p class="border border-zinc-800 bg-zinc-950 p-6 text-xs text-zinc-400 lg:col-span-2">
                {eventError ? copy.events.unavailable : copy.events.empty}
              </p>
            )}
            {upcomingEvents.map((event, index) => {
              const isBandsintownFallback = event.id.startsWith("bandsintown:")
              const detailsUrl = isBandsintownFallback
                ? event.external_event_url
                : pagePath(lang, `/live/${event.slug}/`)
              const ticketUrl = isBandsintownFallback
                ? event.ticket_url
                : event.ticket_url
                  ? crowdrelay.eventTicketUrl(event.slug, campaignIdFromLocation())
                  : null
              const calendarUrl = isBandsintownFallback
                ? null
                : crowdrelay.eventCalendarUrl(event.slug, campaignIdFromLocation())
              const eventDate = new Date(event.starts_at)
              const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(eventDate)
              const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(eventDate).replace(".", "")
              const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(eventDate).replace(".", "")

              return (
                <article
                  key={event.id}
                  class="group relative isolate overflow-hidden border border-zinc-800 bg-zinc-950 transition-all duration-300 hover:border-amber-400/55"
                >
                  <div class="absolute inset-y-0 left-0 w-1 bg-zinc-700 transition-all duration-300 group-hover:w-2 group-hover:bg-amber-400" aria-hidden="true"></div>
                  <div class="absolute -right-14 -top-20 h-48 w-48 rounded-full border border-amber-400/10 transition-transform duration-500 group-hover:scale-110" aria-hidden="true"></div>
                  <div class="relative grid min-h-52 gap-6 p-5 sm:grid-cols-[80px_minmax(0,1fr)] sm:p-6">
                    <time dateTime={event.starts_at} class="flex h-fit min-w-[72px] flex-col border border-zinc-800 bg-black/50 px-2 py-3 text-center transition-colors group-hover:border-amber-400/40">
                      <span class="text-[8px] font-black uppercase tracking-[.2em] text-amber-400">{weekday}</span>
                      <strong class="mt-1 text-3xl font-black leading-none text-white">{day}</strong>
                      <span class="mt-1 text-[8px] font-bold uppercase tracking-[.16em] text-zinc-400">{month}</span>
                    </time>

                    <div class="min-w-0">
                      <div class="flex items-center justify-between gap-3">
                        <span class="font-mono text-[8px] text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
                        <span class="text-[8px] font-black uppercase tracking-[.22em] text-zinc-500">VIRYA // LIVE</span>
                      </div>
                      <p class="mt-4 font-mono text-[9px] uppercase tracking-[.18em] text-amber-400">
                        {formatDate(event.starts_at, locale)}
                      </p>
                      <h3 class="mt-3 max-w-xl text-xl font-black uppercase leading-tight text-white transition-colors group-hover:text-amber-400">
                        {event.title}
                      </h3>
                      <p class="mt-3 text-xs leading-relaxed text-zinc-400">
                        {[event.city?.name, event.venue].filter(Boolean).join(" · ")}
                      </p>
                      <div class="relative z-10 mt-6 flex flex-wrap gap-2">
                        {detailsUrl && (
                          <a
                            href={detailsUrl}
                            target={isBandsintownFallback ? "_blank" : undefined}
                            rel={isBandsintownFallback ? "noopener noreferrer" : undefined}
                            class="inline-flex min-h-[42px] items-center bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300"
                          >
                            {copy.events.details}<span class="ml-2" aria-hidden="true">{isBandsintownFallback ? "↗" : "→"}</span>
                          </a>
                        )}
                        {ticketUrl && (
                          <a
                            href={ticketUrl}
                            target={isBandsintownFallback ? "_blank" : undefined}
                            rel={isBandsintownFallback ? "noopener noreferrer" : undefined}
                            class="inline-flex min-h-[42px] items-center border border-amber-400/60 px-4 text-[9px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-400 hover:text-black"
                          >
                            {copy.events.tickets}<span class="ml-2" aria-hidden="true">↗</span>
                          </a>
                        )}
                        {calendarUrl && (
                          <a
                            href={calendarUrl}
                            target={isBandsintownFallback ? "_blank" : undefined}
                            rel={isBandsintownFallback ? "noopener noreferrer" : undefined}
                            class="inline-flex min-h-[42px] items-center px-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
                          >
                            {copy.events.calendar}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.storedAt > CACHE_TTL_MS) return null
    return entry.value
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { storedAt: Date.now(), value }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Public cache is an optional enhancement.
  }
}
