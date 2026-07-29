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

    void crowdrelay
      .listEvents(20)
      .then(items => {
        if (cancelled) return
        setEvents(items)
        setEventError(false)
        writeCache("virya-signal-events-v1", items)
      })
      .catch(() => {
        if (cancelled) return
        setEventError(true)
        setEvents(current => current ?? [])
      })

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
            <p class="mt-6 max-w-xl text-sm leading-relaxed text-zinc-300 lg:text-base">
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
              <p class="mt-5 text-sm leading-relaxed text-zinc-400">
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
                    <strong class="block text-xl font-black text-amber-400">
                      {city.fan_count}
                    </strong>
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
            <p class="mt-5 text-sm leading-relaxed text-zinc-400">
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
            {upcomingEvents.map(event => (
              <article
                key={event.id}
                class="group relative overflow-hidden border border-zinc-800 bg-zinc-950 p-5 transition-colors hover:border-amber-400/45 sm:p-6"
              >
                <div class="absolute right-0 top-0 h-24 w-24 bg-amber-400/[.04] blur-2xl" aria-hidden="true"></div>
                <p class="font-mono text-[9px] uppercase tracking-[.2em] text-amber-400">
                  {formatDate(event.starts_at, locale)}
                </p>
                <h3 class="mt-3 max-w-xl text-xl font-black uppercase leading-tight text-white group-hover:text-amber-400">
                  {event.title}
                </h3>
                <p class="mt-3 text-xs leading-relaxed text-zinc-400">
                  {[event.city?.name, event.venue].filter(Boolean).join(" · ")}
                </p>
                <div class="mt-6 flex flex-wrap gap-3">
                  <a
                    href={pagePath(lang, `/live/${event.slug}/`)}
                    class="inline-flex min-h-[42px] items-center bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300"
                  >
                    {copy.events.details}
                  </a>
                  {event.ticket_url && (
                    <a
                      href={crowdrelay.eventTicketUrl(
                        event.slug,
                        campaignIdFromLocation(),
                      )}
                      class="inline-flex min-h-[42px] items-center border border-zinc-700 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-200 hover:border-amber-400 hover:text-amber-400"
                    >
                      {copy.events.tickets}
                    </a>
                  )}
                  <a
                    href={crowdrelay.eventCalendarUrl(
                      event.slug,
                      campaignIdFromLocation(),
                    )}
                    class="inline-flex min-h-[42px] items-center px-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
                  >
                    {copy.events.calendar}
                  </a>
                </div>
              </article>
            ))}
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
