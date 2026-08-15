import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type { CitySignal, PublicEvent } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { loadLiveEvents, upcomingLiveEvents } from "../../../lib/liveEvents"
import LiveEventCard, {
  LiveEventNotice,
  LiveEventSkeleton,
} from "../LiveEventCard"
import {
  campaignIdFromLocation,
  clearSynesthesiaHandoff,
  crowdrelay,
  referralCodeFromLocation,
  rememberSignalCity,
  signalCityFromLocation,
  synesthesiaHandoffFromLocation,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
}

type SubmitState = "idle" | "saving" | "pending" | "saved" | "error"
type HandoffState = "idle" | "linking" | "linked" | "login" | "retry" | "error"

type CacheEntry<T> = {
  storedAt: number
  value: T
}

const CACHE_TTL_MS = 5 * 60 * 1000

const signalDotSize = (fanCount: number): number =>
  Math.min(18, 6 + Math.floor(Math.max(0, fanCount) / 10))

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
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [handoffState, setHandoffState] = useState<HandoffState>("idle")
  const [handoffRetryKey, setHandoffRetryKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const campaignId = useMemo(() => campaignIdFromLocation(), [])

  useEffect(() => {
    const code = synesthesiaHandoffFromLocation()
    if (!code) return
    let cancelled = false
    setHandoffState("linking")
    void crowdrelay
      .linkSynesthesiaCompletion(code)
      .then(() => {
        if (cancelled) return
        clearSynesthesiaHandoff()
        setHandoffState("linked")
      })
      .catch(error => {
        if (cancelled) return
        if (error instanceof CrowdRelayError && error.status === 401) {
          setHandoffState("login")
          window.requestAnimationFrame(() =>
            document
              .getElementById("join-signal")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          )
          return
        }
        if (
          error instanceof CrowdRelayError &&
          [404, 409, 422].includes(error.status)
        ) {
          clearSynesthesiaHandoff()
          setHandoffState("error")
          return
        }
        setHandoffState("retry")
      })
    return () => {
      cancelled = true
    }
  }, [handoffRetryKey])

  useEffect(() => {
    const rememberedCity = signalCityFromLocation()
    if (rememberedCity) setSelectedCity(rememberedCity)

    let cancelled = false
    const cachedCities = readCache<CitySignal[]>("virya-signal-cities-v1")
    const cachedEvents = readCache<PublicEvent[]>("virya-signal-events-v2")
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

    void loadLiveEvents()
      .then(items => {
        if (cancelled) return
        setEvents(items)
        setEventError(false)
        writeCache("virya-signal-events-v2", items)
      })
      .catch(() => {
        if (cancelled) return
        setEventError(true)
        setEvents(current => current ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

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
    () => upcomingLiveEvents(events ?? [], { limit: 6 }),
    [events],
  )

  function goToCityStep() {
    const email = formRef.current?.elements.namedItem(
      "email",
    ) as HTMLInputElement | null
    if (!email?.checkValidity()) {
      email?.reportValidity()
      return
    }
    setFormStep(2)
  }

  function goToConsentStep() {
    if (!selectedCity) {
      setSubmitState("error")
      setSubmitMessage(copy.form.validationError)
      return
    }
    setSubmitState("idle")
    setSubmitMessage("")
    setFormStep(3)
  }

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
        if (result.email_queued === true) {
          setSubmitMessage(
            result.email_kind === "session_recovery"
              ? copy.form.recoveryBody
              : copy.form.pendingBody,
          )
        } else if (result.email_queued === false) {
          const minutes = Math.max(
            1,
            Math.ceil((result.retry_after_seconds ?? 15 * 60) / 60),
          )
          setSubmitMessage(copy.form.cooldownBody(minutes))
        } else {
          setSubmitMessage(copy.form.acceptedBody)
        }
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
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "VIRYA Signal",
          text: lang === "pl"
            ? "Jeśli ciężka muzyka i lokalna scena są też Twoim światem, złap ten sygnał."
            : "If heavy music and the local scene are your world too, catch this signal.",
          url: referralUrl,
        })
        setCopied(true)
        return
      }
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      try {
        await navigator.clipboard.writeText(referralUrl)
        setCopied(true)
      } catch {
        setCopied(false)
      }
    }
  }

  return (
    <>
      {handoffState !== "idle" && (
        <aside
          class={`mx-auto mb-6 max-w-7xl border px-5 py-4 text-sm ${handoffState === "linked" ? "border-emerald-400/30 bg-emerald-400/[.06] text-emerald-100" : "border-amber-400/30 bg-amber-400/[.05] text-zinc-200"}`}
          aria-live="polite"
          aria-busy={handoffState === "linking"}
        >
          <p class="font-black uppercase tracking-[.16em]">
            {handoffState === "linking" &&
              (lang === "pl"
                ? "ŁĄCZĘ SYNESTEZJĘ Z TWOIM SYGNAŁEM…"
                : "LINKING SYNESTHESIA TO YOUR SIGNAL…")}
            {handoffState === "linked" &&
              (lang === "pl"
                ? "SYNESTEZJA JEST JUŻ CZĘŚCIĄ TWOJEGO SYGNAŁU"
                : "SYNESTHESIA IS NOW PART OF YOUR SIGNAL")}
            {handoffState === "login" &&
              (lang === "pl"
                ? "UKOŃCZENIE CZEKA NA TWOJĄ SESJĘ"
                : "YOUR COMPLETION IS WAITING FOR YOUR SESSION")}
            {handoffState === "retry" &&
              (lang === "pl"
                ? "SYGNAŁ CHWILOWO NIE ODPOWIADA — KOD JEST BEZPIECZNY"
                : "SIGNAL IS TEMPORARILY UNAVAILABLE — YOUR CODE IS SAFE")}
            {handoffState === "error" &&
              (lang === "pl"
                ? "TEGO ŁĄCZA NIE DA SIĘ JUŻ UŻYĆ"
                : "THIS LINK CAN NO LONGER BE USED")}
          </p>
          {handoffState === "login" && (
            <button
              type="button"
              class="mt-3 inline-flex min-h-[44px] items-center font-black uppercase tracking-widest text-amber-400"
              onClick={() =>
                document
                  .getElementById("join-signal")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {lang === "pl"
                ? "POŁĄCZ / ODZYSKAJ SESJĘ"
                : "CONNECT / RECOVER SESSION"}{" "}
              →
            </button>
          )}
          {handoffState === "retry" && (
            <button
              type="button"
              class="mt-3 inline-flex min-h-[44px] items-center font-black uppercase tracking-widest text-amber-400"
              onClick={() => setHandoffRetryKey(value => value + 1)}
            >
              {lang === "pl" ? "SPRÓBUJ PONOWNIE" : "TRY AGAIN"} →
            </button>
          )}
          {handoffState === "error" && (
            <p class="mt-2 text-xs text-zinc-400">
              {lang === "pl"
                ? "Kod mógł wygasnąć lub zostać już wykorzystany. Twoje ukończenie nadal pozostaje zapisane w Synestezji."
                : "The code may have expired or already been used. Your completion remains saved in Synesthesia."}
            </p>
          )}
        </aside>
      )}
      <section
        id="join-signal"
        class="virya-section scroll-mt-24 border-y border-zinc-800/60 bg-black/30"
      >
        <div class="virya-section__inner grid gap-10 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:gap-16">
          <div>
            <p class="virya-eyebrow">{copy.form.eyebrow}</p>
            <h2 class="virya-heading mt-4">{copy.form.heading}</h2>
            <p class="virya-copy mt-6 text-zinc-300">{copy.form.body}</p>
            <div class="mt-8 grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {copy.teaser.chips.slice(0, 3).map((chip, index) => (
                <div class="bg-zinc-950 p-4" key={chip}>
                  <span class="font-mono text-[8px] text-amber-400">
                    0{index + 1}
                  </span>
                  <p class="mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-300">
                    {chip}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div class="virya-panel p-5 shadow-2xl sm:p-7 lg:p-8">
            <form ref={formRef} onSubmit={submit} noValidate>
              <div
                class="mb-6"
                aria-label={
                  lang === "pl"
                    ? `Krok ${formStep} z 3`
                    : `Step ${formStep} of 3`
                }
              >
                <div class="flex items-center justify-between text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">
                  <span>
                    {lang === "pl"
                      ? `KROK ${formStep} Z 3`
                      : `STEP ${formStep} OF 3`}
                  </span>
                  <span class="text-amber-400">
                    {["Kontakt", "Miasto", "Gotowe"][formStep - 1]}
                  </span>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
                  {[1, 2, 3].map(step => (
                    <span
                      class={`h-1 ${step <= formStep ? "bg-amber-400" : "bg-zinc-800"}`}
                    ></span>
                  ))}
                </div>
              </div>

              <div hidden={formStep !== 1} class="grid gap-5">
                <div class="rounded border border-amber-400/25 bg-amber-400/[.035] p-4 text-xs leading-relaxed text-zinc-300">
                  <strong class="block text-sm uppercase text-white">
                    {lang === "pl" ? "Po co to jest?" : "What is this for?"}
                  </strong>
                  <span class="mt-2 block">
                    {lang === "pl"
                      ? "Żeby dostawać koncerty blisko Ciebie i trzymać bilety oraz aktywne nagrody w jednym miejscu."
                      : "To get nearby show alerts and keep tickets and active rewards in one place."}
                  </span>
                </div>
                <label class="block">
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
                    class="virya-input mt-2 min-h-[50px] bg-zinc-900 px-4 text-sm"
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
                    class="virya-input mt-2 min-h-[50px] bg-zinc-900 px-4 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={goToCityStep}
                  class="virya-button virya-button--primary min-h-[50px] px-6"
                >
                  {lang === "pl" ? "DALEJ: MIASTO" : "NEXT: CITY"} →
                </button>
              </div>

              <div hidden={formStep !== 2} class="grid gap-5">
                <label class="block">
                  <span class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-400">
                    {copy.form.city}
                  </span>
                  <select
                    name="city"
                    required
                    value={selectedCity}
                    onChange={event =>
                      setSelectedCity(
                        (event.currentTarget as HTMLSelectElement).value,
                      )
                    }
                    disabled={cities === null || submitState === "saving"}
                    class="virya-input mt-2 min-h-[50px] bg-zinc-900 px-4 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {cities === null
                        ? copy.form.loadingCities
                        : copy.form.cityPlaceholder}
                    </option>
                    {(cities ?? []).map(city => (
                      <option value={city.slug} key={city.slug}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                {cityError && (
                  <div class="border border-amber-400/30 bg-amber-400/[.035] p-4 text-xs text-zinc-300">
                    <p>{copy.form.loadError}</p>
                    <button
                      type="button"
                      onClick={() => setReloadKey(value => value + 1)}
                      class="mt-3 min-h-[42px] font-black uppercase tracking-widest text-amber-400"
                    >
                      {lang === "pl" ? "SPRÓBUJ PONOWNIE" : "TRY AGAIN"}
                    </button>
                  </div>
                )}
                <p class="text-xs leading-relaxed text-zinc-400">
                  {lang === "pl"
                    ? "Miasto służy do alertów o koncertach. Nie publikujemy małych liczników fanów."
                    : "Your city is used for nearby show alerts. We do not publish small fan counters."}
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    class="virya-button virya-button--secondary min-h-[48px]"
                  >
                    ← {lang === "pl" ? "WRÓĆ" : "BACK"}
                  </button>
                  <button
                    type="button"
                    onClick={goToConsentStep}
                    class="virya-button virya-button--primary min-h-[48px]"
                  >
                    {lang === "pl" ? "DALEJ" : "NEXT"} →
                  </button>
                </div>
              </div>

              <div hidden={formStep !== 3} class="grid gap-5">
                <div class="rounded border border-zinc-800 bg-zinc-900/60 p-4">
                  <strong class="text-sm uppercase text-white">
                    {lang === "pl"
                      ? "Po zapisie od razu"
                      : "Immediately after joining"}
                  </strong>
                  <ul class="mt-3 grid gap-2 text-xs text-zinc-300">
                    <li>
                      ✓{" "}
                      {lang === "pl"
                        ? "zobaczysz następny koncert"
                        : "see the next show"}
                    </li>
                    <li>
                      ✓{" "}
                      {lang === "pl"
                        ? "dostaniesz prywatny Sygnał"
                        : "get your private Signal"}
                    </li>
                    <li>
                      ✓{" "}
                      {lang === "pl"
                        ? "opcjonalnie zaprosisz znajomego"
                        : "optionally invite a friend"}
                    </li>
                  </ul>
                </div>
                <label class="flex cursor-pointer items-start gap-3 border-l-2 border-amber-400/50 bg-amber-400/[.035] p-4">
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
                <p class="text-[9px] leading-relaxed text-zinc-500">
                  {copy.form.privacy}
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStep(2)}
                    class="virya-button virya-button--secondary min-h-[48px]"
                  >
                    ← {lang === "pl" ? "WRÓĆ" : "BACK"}
                  </button>
                  <button
                    type="submit"
                    disabled={cities === null || submitState === "saving"}
                    class="virya-button virya-button--primary min-h-[48px] px-4 disabled:cursor-wait"
                  >
                    {submitState === "saving"
                      ? copy.form.saving
                      : copy.form.submit}
                  </button>
                </div>
              </div>
            </form>

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
                        class="virya-button virya-button--secondary min-h-[44px] px-4"
                      >
                        {copied ? copy.form.copied : copy.form.copy}
                      </button>
                    )}
                    <a
                      href={pagePath(lang, "/my-signal/")}
                      class="virya-button virya-button--primary min-h-[44px] px-4"
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
        class="virya-section signal-deferred scroll-mt-24"
      >
        <div class="virya-section__inner">
          <div class="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
            <div>
              <p class="virya-eyebrow">{copy.cities.eyebrow}</p>
              <h2 class="virya-heading mt-4 !text-[clamp(2rem,6vw,3.8rem)]">
                {copy.cities.heading}
              </h2>
              <p class="virya-copy mt-5">{copy.cities.body}</p>
            </div>

            <div class="grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
              {cities === null && (
                <p
                  class="bg-zinc-950 p-6 text-xs text-zinc-400 sm:col-span-2"
                  aria-busy="true"
                >
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
                      <span
                        class="relative inline-flex shrink-0 items-center justify-center"
                        style={{
                          width: `${signalDotSize(city.fan_count)}px`,
                          height: `${signalDotSize(city.fan_count)}px`,
                        }}
                        aria-hidden="true"
                      >
                        {city.fan_count > 0 ? (
                          <>
                            <span class="absolute inset-0 rounded-full bg-amber-400/35 motion-safe:animate-ping"></span>
                            <span class="relative h-full w-full rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,.82)] motion-safe:animate-pulse"></span>
                          </>
                        ) : (
                          <span class="relative h-full w-full rounded-full bg-zinc-600 shadow-[0_0_7px_rgba(113,113,122,.35)]"></span>
                        )}
                      </span>
                      <strong class="block text-sm font-black uppercase text-amber-400">
                        {city.fan_count >= 25
                          ? city.fan_count
                          : lang === "pl"
                            ? "rośnie"
                            : "growing"}
                      </strong>
                    </span>
                    <span class="text-[8px] uppercase tracking-widest text-zinc-500">
                      {city.fan_count >= 25
                        ? copy.cities.people(city.fan_count)
                        : lang === "pl"
                          ? "bez rankingu"
                          : "no ranking"}
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
        class="virya-section signal-deferred scroll-mt-24 border-t border-zinc-800/60 bg-black/30"
      >
        <div class="virya-section__inner">
          <div class="max-w-3xl">
            <p class="virya-eyebrow">{copy.events.eyebrow}</p>
            <h2 class="virya-heading mt-4 !text-[clamp(2rem,6vw,3.8rem)]">
              {copy.events.heading}
            </h2>
            <p class="virya-copy mt-5">{copy.events.body}</p>
          </div>

          <div class="mt-10 grid gap-4 lg:grid-cols-2">
            {events === null ? (
              <>
                <LiveEventSkeleton />
                <LiveEventSkeleton />
              </>
            ) : upcomingEvents.length === 0 ? (
              <div class="grid gap-3">
                <LiveEventNotice
                  message={
                    eventError ? copy.events.unavailable : copy.events.empty
                  }
                />
                {eventError && (
                  <button
                    type="button"
                    onClick={() => setReloadKey(value => value + 1)}
                    class="virya-button virya-button--secondary justify-self-start"
                  >
                    {lang === "pl" ? "ODŚWIEŻ KONCERTY" : "RETRY SHOWS"}
                  </button>
                )}
              </div>
            ) : (
              upcomingEvents.map((event, index) => (
                <LiveEventCard
                  key={event.id}
                  event={event}
                  lang={lang}
                  index={index}
                  campaignId={campaignId}
                  labels={{
                    details: copy.events.details,
                    tickets: copy.events.tickets,
                    calendar: copy.events.calendar,
                  }}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
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
