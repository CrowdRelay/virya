import { useEffect, useMemo, useState } from "preact/hooks"
import AdmissionPassCard from "./AdmissionPassCard"
import PushNotificationControl from "./PushNotificationControl"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type {
  AdmissionPass,
  FanEventInterest,
  FanHomeSnapshot,
  ReferralProgress,
} from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import {
  clearSynesthesiaHandoff,
  crowdrelay,
  synesthesiaHandoffFromLocation,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()
const dateOnlyFormatters = new Map<string, Intl.DateTimeFormat>()

const EMPTY_PROGRESS: ReferralProgress = {
  referral_code: "",
  qualified_referrals: 0,
  pending_referrals: 0,
  next_reward_threshold: null,
  draw_entries: [],
  coupons: [],
  physical_rewards: [],
}

type State =
  | { kind: "loading" }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | {
      kind: "ready"
      home: FanHomeSnapshot
      progress: ReferralProgress
      events: FanEventInterest[]
      admissionPass: AdmissionPass | null
      detailsLoading: boolean
    }

export default function MySignal({ lang }: Props) {
  const copy = SIGNAL_COPY[lang].account
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [state, setState] = useState<State>({ kind: "loading" })
  const [copied, setCopied] = useState(false)
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [recoveryState, setRecoveryState] = useState<"idle" | "sending" | "sent" | "error">("idle")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const handoff = synesthesiaHandoffFromLocation()
      if (handoff) {
        try {
          await crowdrelay.linkSynesthesiaCompletion(handoff)
          if (!cancelled) clearSynesthesiaHandoff()
        } catch (error) {
          if (cancelled) return
          if (error instanceof CrowdRelayError && error.status === 401) {
            setState({ kind: "unauthorized" })
            return
          }
          if (
            error instanceof CrowdRelayError &&
            [404, 409, 422].includes(error.status)
          ) {
            clearSynesthesiaHandoff()
          }
          // Keep transient/network failures in the fragment so a retry never
          // destroys the completion handoff before it is consumed.
        }
      }

      let home: FanHomeSnapshot
      try {
        home = await crowdrelay.getFanHome()
      } catch (error) {
        if (cancelled) return
        setState(
          error instanceof CrowdRelayError && error.status === 401
            ? { kind: "unauthorized" }
            : { kind: "error" },
        )
        return
      }
      if (cancelled) return

      // The single fan/home read-model unlocks the useful dashboard first.
      // Detailed reward/pass/interest views enrich it without extending TTI.
      setState({
        kind: "ready",
        home,
        progress: EMPTY_PROGRESS,
        events: [],
        admissionPass: null,
        detailsLoading: true,
      })

      const [progressResult, eventsResult, passResult] =
        await Promise.allSettled([
          crowdrelay.getReferralProgress(),
          crowdrelay.listMyEvents(),
          crowdrelay.getMyAdmissionPass(),
        ])
      if (cancelled) return
      const authFailure = [progressResult, eventsResult, passResult].some(
        result =>
          result.status === "rejected" &&
          result.reason instanceof CrowdRelayError &&
          result.reason.status === 401,
      )
      if (authFailure) {
        setState({ kind: "unauthorized" })
        return
      }
      setState(current =>
        current.kind === "ready"
          ? {
              ...current,
              progress:
                progressResult.status === "fulfilled"
                  ? progressResult.value
                  : current.progress,
              events:
                eventsResult.status === "fulfilled"
                  ? eventsResult.value
                  : current.events,
              admissionPass:
                passResult.status === "fulfilled"
                  ? passResult.value
                  : current.admissionPass,
              detailsLoading: false,
            }
          : current,
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const referralUrl = useMemo(() => {
    if (state.kind !== "ready" || !state.progress.referral_code) return null
    return `https://www.virya.music/r/${encodeURIComponent(
      state.progress.referral_code,
    )}`
  }, [state])

  async function requestSessionRecovery(event: SubmitEvent) {
    event.preventDefault()
    const email = recoveryEmail.trim()
    if (!email || recoveryState === "sending") return
    setRecoveryState("sending")
    try {
      await crowdrelay.requestFanAccess(email, locale)
      // The response is intentionally neutral to prevent account enumeration.
      // Keep the Synesthesia handoff in storage; the confirmation/recovery link
      // returns here and consumes it once the fan session exists.
      setRecoveryState("sent")
    } catch {
      setRecoveryState("error")
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

  async function copyCoupon(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCoupon(code)
    } catch {
      setCopiedCoupon(null)
    }
  }

  if (state.kind === "loading") {
    return (
      <div class="virya-panel p-6" aria-busy="true">
        <p class="text-xs font-semibold text-zinc-400">{copy.loading}</p>
      </div>
    )
  }

  if (state.kind === "unauthorized" || state.kind === "error") {
    const pendingHandoff = synesthesiaHandoffFromLocation()
    const joinHref = pendingHandoff
      ? `${pagePath(lang, "/signal/")}#join-signal&handoff=${encodeURIComponent(pendingHandoff)}`
      : pagePath(lang, "/signal/#join-signal")
    return (
      <div class="virya-panel relative overflow-hidden border-amber-400/30 bg-amber-400/[.035] p-6 sm:p-8">
        <div class="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"></div>
        <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">{copy.eyebrow}</p>
        <h2 class="mt-3 max-w-2xl text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
          {state.kind === "unauthorized"
            ? pendingHandoff
              ? lang === "pl" ? "Dokończ połączenie z Signal" : "Finish connecting to Signal"
              : copy.unauthorizedTitle
            : copy.heading}
        </h2>
        <p class="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 text-justify mobile-justify">
          {state.kind === "unauthorized"
            ? pendingHandoff
              ? lang === "pl"
                ? "Wynik Synesthesia czeka bezpiecznie. Jeśli masz już Signal, wpisz e-mail — wyślemy link do odzyskania sesji. Po jego otwarciu wrócisz tutaj i wynik połączy się automatycznie."
                : "Your Synesthesia result is waiting safely. If you already have Signal, enter your email and we will send a session recovery link. After opening it, return here and the result will connect automatically."
              : copy.unauthorizedBody
            : SIGNAL_COPY[lang].form.loadError}
        </p>

        {state.kind === "unauthorized" && pendingHandoff && (
          <form onSubmit={requestSessionRecovery} class="mt-6 max-w-md rounded-xl border border-cyan-300/15 bg-black/20 p-4">
            <label class="block text-xs font-black uppercase tracking-wider text-zinc-300">
              {lang === "pl" ? "E-mail w Virya Signal" : "Virya Signal email"}
              <input
                type="email"
                autocomplete="email"
                value={recoveryEmail}
                onInput={event => {
                  setRecoveryEmail((event.currentTarget as HTMLInputElement).value)
                  if (recoveryState === "error") setRecoveryState("idle")
                }}
                class="mt-2 min-h-12 w-full border border-white/15 bg-black/40 px-4 text-sm text-white outline-none focus:border-cyan-300"
                required
              />
            </label>
            <button type="submit" disabled={recoveryState === "sending" || recoveryState === "sent"} class="virya-button virya-button--primary mt-3 min-h-[46px] px-5 disabled:opacity-50">
              {recoveryState === "sending"
                ? lang === "pl" ? "WYSYŁAM…" : "SENDING…"
                : recoveryState === "sent"
                  ? lang === "pl" ? "LINK WYSŁANY" : "LINK SENT"
                  : lang === "pl" ? "WYŚLIJ LINK DO SIGNAL" : "SEND SIGNAL LINK"}
            </button>
            <p class={`mt-3 text-xs leading-relaxed ${recoveryState === "error" ? "text-rose-300" : "text-zinc-500"}`} role="status" aria-live="polite">
              {recoveryState === "sent"
                ? lang === "pl"
                  ? "Jeśli adres jest zapisany w Signal, link jest w drodze. Wynik Synesthesia pozostaje zachowany podczas logowania."
                  : "If the address belongs to Signal, the link is on its way. Your Synesthesia result remains saved during sign-in."
                : recoveryState === "error"
                  ? lang === "pl" ? "Nie udało się wysłać linku. Spróbuj ponownie za chwilę." : "We could not send the link. Try again shortly."
                  : lang === "pl" ? "Nie masz jeszcze Signal? Możesz utworzyć profil poniżej." : "New to Signal? You can create a profile below."}
            </p>
          </form>
        )}

        <div class="mt-6 flex flex-wrap gap-3">
          {state.kind === "error" && (
            <button type="button" onClick={() => { setState({ kind: "loading" }); setReloadKey(value => value + 1) }} class="virya-button virya-button--primary min-h-[46px] px-5">
              {lang === "pl" ? "SPRÓBUJ PONOWNIE" : "TRY AGAIN"}
            </button>
          )}
          <a href={joinHref} class="virya-button virya-button--secondary min-h-[46px] px-5">
            {pendingHandoff
              ? lang === "pl" ? "NIE MAM SIGNAL — UTWÓRZ PROFIL" : "NEW TO SIGNAL — CREATE PROFILE"
              : copy.join}
          </a>
        </div>
      </div>
    )
  }

  const { home, progress, events, admissionPass, detailsLoading } = state
  const drawEntries = progress.draw_entries ?? []
  const coupons = progress.coupons ?? []
  const physicalRewards = progress.physical_rewards ?? []

  const nextEvent = home.next_event
  const synesthesia = home.synesthesia

  return (
    <div class="grid gap-6">
      <section class="virya-panel border-amber-400/20 bg-amber-400/[.025] p-5 sm:p-6">
        <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
          {lang === "pl" ? "VIRYA SIGNAL / POWIADOMIENIA" : "VIRYA SIGNAL / NOTIFICATIONS"}
        </p>
        <h2 class="mt-2 text-lg font-black uppercase text-white">
          {lang === "pl" ? "Dostań sygnał na telefon" : "Get the signal on your phone"}
        </h2>
        <p class="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">
          {lang === "pl"
            ? "Koncerty w pobliżu i najważniejsze aktualizacje mogą trafić bezpośrednio na to urządzenie. Zgoda jest opcjonalna i możesz ją wyłączyć w każdej chwili."
            : "Nearby shows and important updates can reach this device directly. Push is optional and can be disabled at any time."}
        </p>
        <PushNotificationControl lang={lang} />
      </section>

      <section class="virya-panel overflow-hidden border-cyan-300/20 bg-cyan-300/[.025] p-5 sm:p-7">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[.3em] text-cyan-300">
              {lang === "pl" ? "TWÓJ SYGNAŁ TERAZ" : "YOUR SIGNAL NOW"}
            </p>
            <h2 class="mt-3 text-2xl font-black uppercase text-white">
              {home.profile.display_name ||
                (lang === "pl" ? "Połączenie aktywne" : "Signal connected")}
            </h2>
            <p class="mt-2 text-xs text-zinc-400">
              {home.profile.primary_city
                ? `${lang === "pl" ? "Miasto" : "City"}: ${home.profile.primary_city}`
                : lang === "pl"
                  ? "Kontekst aktualizuje się wraz z Twoimi akcjami."
                  : "Context updates with your actions."}
            </p>
          </div>
          <div class="grid grid-cols-3 gap-px border border-zinc-800 bg-zinc-800 text-center">
            <div class="bg-zinc-950 px-4 py-3">
              <strong class="block text-xl text-white">
                {home.counts.active_passes}
              </strong>
              <span class="text-[8px] uppercase tracking-widest text-zinc-500">
                PASS
              </span>
            </div>
            <div class="bg-zinc-950 px-4 py-3">
              <strong class="block text-xl text-white">
                {home.counts.area_claims}
              </strong>
              <span class="text-[8px] uppercase tracking-widest text-zinc-500">
                AREA
              </span>
            </div>
            <div class="bg-zinc-950 px-4 py-3">
              <strong class="block text-xl text-white">
                {home.referral.qualified}
              </strong>
              <span class="text-[8px] uppercase tracking-widest text-zinc-500">
                REF
              </span>
            </div>
          </div>
        </div>
        <div class="mt-6 grid gap-3 md:grid-cols-2">
          <div class="border border-zinc-800 bg-black/40 p-4">
            <p class="text-[8px] font-black uppercase tracking-[.24em] text-cyan-300">
              SYNESTEZJA
            </p>
            <p class="mt-2 text-sm font-bold text-white">
              {synesthesia.completed
                ? lang === "pl"
                  ? "Podróż ukończona i połączona"
                  : "Journey completed and linked"
                : `${Math.max(0, synesthesia.rooms_completed)}/11 ${lang === "pl" ? "pokojów" : "rooms"}`}
            </p>
            {synesthesia.best_elapsed_ms !== null && (
              <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200/80">
                {lang === "pl" ? "Najlepszy czas" : "Best time"}{" "}
                {formatElapsed(synesthesia.best_elapsed_ms)}
                {synesthesia.leaderboard_published &&
                  synesthesia.leaderboard_rank !== null &&
                  ` · #${synesthesia.leaderboard_rank}`}
              </p>
            )}
            <a
              href="https://synesthesia.virya.music/?source=signal-web&resume=1"
              class="mt-3 inline-flex min-h-[44px] items-center text-[9px] font-black uppercase tracking-widest text-cyan-300"
            >
              {synesthesia.completed
                ? lang === "pl"
                  ? "WRÓĆ DO ALBUM MODE"
                  : "RETURN TO ALBUM MODE"
                : lang === "pl"
                  ? "KONTYNUUJ PODRÓŻ"
                  : "CONTINUE JOURNEY"}{" "}
              →
            </a>
          </div>
          {nextEvent ? (
            <div
              class={`border bg-black/40 p-4 ${nextEvent.phase === "live" ? "border-rose-400/50" : nextEvent.phase === "afterglow" ? "border-cyan-300/30" : "border-zinc-800"}`}
            >
              <p
                class={`text-[8px] font-black uppercase tracking-[.24em] ${nextEvent.phase === "live" ? "text-rose-300" : nextEvent.phase === "afterglow" ? "text-cyan-300" : "text-amber-400"}`}
              >
                {nextEvent.phase === "live"
                  ? lang === "pl"
                    ? "SYGNAŁ TRWA TERAZ"
                    : "SIGNAL LIVE NOW"
                  : nextEvent.phase === "afterglow"
                    ? lang === "pl"
                      ? "PO SYGNALE"
                      : "AFTER THE SIGNAL"
                    : lang === "pl"
                      ? "NASTĘPNY SYGNAŁ"
                      : "NEXT SIGNAL"}
              </p>
              <p class="mt-2 text-sm font-bold text-white">{nextEvent.title}</p>
              <p class="mt-1 text-xs text-zinc-400">
                {[nextEvent.city, nextEvent.venue].filter(Boolean).join(" · ")}
              </p>
              {nextEvent.phase === "live" && (
                <p class="mt-2 text-[10px] leading-relaxed text-rose-100/80">
                  {lang === "pl"
                    ? "Bilet, pass i kontekst koncertu są teraz najważniejsze."
                    : "Your ticket, pass and show context are the priority right now."}
                </p>
              )}
              {nextEvent.phase === "afterglow" && (
                <p class="mt-2 text-[10px] leading-relaxed text-cyan-100/75">
                  {lang === "pl"
                    ? "Koncert właśnie wybrzmiał — to dobry moment na krótkie echo po występie."
                    : "The show just ended — this is a good moment to leave a short post-show echo."}
                </p>
              )}
              <a
                href={pagePath(lang, `/live/${nextEvent.slug}/`)}
                class="mt-3 inline-flex min-h-[44px] items-center text-[9px] font-black uppercase tracking-widest text-amber-400"
              >
                {lang === "pl"
                  ? "OTWÓRZ KONTEKST KONCERTU"
                  : "OPEN EVENT CONTEXT"}{" "}
                →
              </a>
            </div>
          ) : (
            <div class="border border-zinc-800 bg-black/40 p-4 text-xs text-zinc-400">
              {lang === "pl"
                ? "Kolejny koncert pojawi się tutaj, gdy tylko zostanie opublikowany."
                : "Your next show will appear here as soon as it is published."}
            </div>
          )}
        </div>
      </section>
      {detailsLoading ? (
        <section class="virya-panel p-5" aria-busy="true">
          <p class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-500">
            {lang === "pl"
              ? "DOCZYTUJĘ NAGRODY I PASSY…"
              : "LOADING REWARDS & PASSES…"}
          </p>
        </section>
      ) : progress.qualified_referrals === 0 &&
        progress.pending_referrals === 0 ? (
        <section class="virya-panel border-amber-400/30 bg-amber-400/[.035] p-6">
          <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
            {lang === "pl" ? "SYGNAŁ JEST GOTOWY" : "SIGNAL READY"}
          </p>
          <h2 class="mt-3 text-2xl font-black uppercase text-white">
            {lang === "pl"
              ? "Pierwszy efekt masz od razu"
              : "Your first result is immediate"}
          </h2>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
            {lang === "pl"
              ? "Sprawdź najbliższy koncert albo zachowaj link polecający na później. Nie musisz teraz wykonywać kolejnych etapów."
              : "Check the nearest show or save your referral link for later. There is no need to complete every stage now."}
          </p>
        </section>
      ) : (
        <section class="grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
          <div class="bg-zinc-950 p-5 sm:p-6">
            <p class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-500">
              {copy.qualified}
            </p>
            <p class="mt-3 text-4xl font-black text-amber-400">
              {progress.qualified_referrals}
            </p>
          </div>
          <div class="bg-zinc-950 p-5 sm:p-6">
            <p class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-500">
              {copy.pending}
            </p>
            <p class="mt-3 text-4xl font-black text-white">
              {progress.pending_referrals}
            </p>
          </div>
          <div class="bg-zinc-950 p-5 sm:p-6">
            <p class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-500">
              {copy.referrals}
            </p>
            <p class="mt-3 text-xs leading-relaxed text-zinc-300">
              {progress.next_reward_threshold
                ? copy.nextReward(progress.next_reward_threshold)
                : copy.allUnlocked}
            </p>
          </div>
        </section>
      )}

      {referralUrl && (
        <section class="virya-panel border-amber-400/30 bg-amber-400/[.035] p-5 sm:p-6">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
              <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
                {SIGNAL_COPY[lang].form.referralTitle}
              </p>
              <code class="mt-3 block break-all text-xs text-zinc-300">
                {referralUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={copyReferral}
              class="virya-button virya-button--accent-outline shrink-0"
            >
              {copied ? copy.linkCopied : copy.copyLink}
            </button>
          </div>
        </section>
      )}

      {admissionPass && <AdmissionPassCard lang={lang} pass={admissionPass} />}

      <section class="virya-panel border-amber-400/30 bg-amber-400/[.025] p-5 sm:p-6">
        <div>
          <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
            {lang === "pl" ? "VIRYA // LOSOWANIA" : "VIRYA // DRAW"}
          </p>
          <h2 class="mt-2 text-2xl font-black uppercase text-white">
            {copy.draws}
          </h2>
        </div>

        {drawEntries.length === 0 ? (
          <p class="mt-5 max-w-2xl text-justify text-xs leading-relaxed text-zinc-400">
            {copy.noDraws}
          </p>
        ) : (
          <ul class="mt-6 grid gap-3 lg:grid-cols-2">
            {drawEntries.map(draw => (
              <li key={draw.draw_id} class="virya-panel p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-[8px] font-black uppercase tracking-[.24em] text-zinc-500">
                      {draw.prize_kind === "admission_pass"
                        ? lang === "pl"
                          ? "Wejściówki"
                          : "Guest list"
                        : lang === "pl"
                          ? "Album / nagroda fizyczna"
                          : "Album / physical prize"}
                    </p>
                    <h3 class="mt-2 text-base font-black uppercase text-white">
                      {draw.name}
                    </h3>
                  </div>
                  <strong class="text-3xl font-black text-amber-400">
                    {draw.total_entries}
                  </strong>
                </div>
                <p class="mt-3 text-xs font-semibold text-zinc-300">
                  {copy.drawEntries(draw.total_entries)} ·{" "}
                  {copy.drawReferrals(draw.qualified_referrals)}
                  {draw.concert_checkins > 0 && (
                    <> · {copy.drawCheckins(draw.concert_checkins)}</>
                  )}
                </p>
                <dl class="mt-5 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
                  <div>
                    <dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                      {copy.drawCloses}
                    </dt>
                    <dd class="mt-1 text-[10px] text-zinc-300">
                      {formatDate(draw.closes_at, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                      {copy.drawAt}
                    </dt>
                    <dd class="mt-1 text-[10px] text-zinc-300">
                      {formatDate(draw.draw_at, locale)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="virya-panel p-5 sm:p-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
              {lang === "pl" ? "VIRYA // NAGRODY" : "VIRYA // REWARDS"}
            </p>
            <h2 class="mt-2 text-2xl font-black uppercase text-white">
              {copy.rewards}
            </h2>
          </div>
          <a
            href={pagePath(lang, "/area/#area-collection")}
            class="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
          >
            {copy.openArea} →
          </a>
        </div>

        {coupons.length === 0 && physicalRewards.length === 0 ? (
          <p class="mt-5 text-xs leading-relaxed text-zinc-400">
            {copy.noRewards}
          </p>
        ) : (
          <ul class="mt-6 grid gap-3 sm:grid-cols-2">
            {physicalRewards.map(reward => (
              <li
                class="border border-amber-400/30 bg-amber-400/[.035] p-4"
                key={reward.reward_grant_id}
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-[8px] font-black uppercase tracking-widest text-amber-400">
                      {copy.physicalReward}
                    </p>
                    <h3 class="mt-2 text-sm font-black uppercase text-white">
                      {reward.item_name}
                    </h3>
                  </div>
                  <span class="shrink-0 text-right text-[8px] font-black uppercase tracking-widest text-zinc-400">
                    {copy.rewardStatus[reward.status]}
                  </span>
                </div>
                <p class="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                  {reward.sku}
                </p>
                {reward.expires_at && (
                  <p class="mt-3 text-[10px] text-zinc-300">
                    {copy.rewardExpires}:{" "}
                    {formatDate(reward.expires_at, locale)}
                  </p>
                )}
              </li>
            ))}
            {coupons.map(coupon => (
              <li
                class="border border-zinc-800 bg-zinc-900/50 p-4"
                key={coupon.id}
              >
                <div class="flex items-start justify-between gap-3">
                  <code class="break-all text-sm font-black text-amber-400">
                    {coupon.code}
                  </code>
                  <span class="shrink-0 text-[8px] font-black uppercase tracking-widest text-zinc-500">
                    {coupon.status}
                  </span>
                </div>
                <p class="mt-3 text-xs text-zinc-300">
                  {coupon.discount_percent}%
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyCoupon(coupon.code)}
                    class="virya-button virya-button--secondary min-h-[40px] px-3"
                  >
                    {copiedCoupon === coupon.code
                      ? SIGNAL_COPY[lang].form.copied
                      : SIGNAL_COPY[lang].form.copy}
                  </button>
                  <a
                    href={pagePath(lang, "/merch/")}
                    class="virya-button virya-button--primary min-h-[40px] px-3"
                  >
                    {copy.useInStore}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="virya-panel p-5 sm:p-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="text-[9px] font-black uppercase tracking-[.28em] text-amber-400">
              VIRYA // LIVE
            </p>
            <h2 class="mt-2 text-2xl font-black uppercase text-white">
              {copy.concerts}
            </h2>
          </div>
          <a
            href={pagePath(lang, "/signal/#signal-shows")}
            class="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400"
          >
            + {SIGNAL_COPY[lang].events.heading}
          </a>
        </div>

        {events.length === 0 ? (
          <p class="mt-5 text-xs text-zinc-400">{copy.noConcerts}</p>
        ) : (
          <ul class="mt-6 grid gap-px border border-zinc-800 bg-zinc-800">
            {events.map(({ event, interested_at }) => (
              <li
                key={event.id}
                class="flex flex-col gap-4 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p class="font-mono text-[8px] uppercase tracking-widest text-amber-400">
                    {formatDate(event.starts_at, locale)}
                  </p>
                  <h3 class="mt-2 text-sm font-black uppercase text-white">
                    {event.title}
                  </h3>
                  <p class="mt-1 text-[9px] uppercase tracking-widest text-zinc-500">
                    {event.city?.name ?? event.venue ?? "Virya"} ·{" "}
                    {formatDateOnly(interested_at, locale)}
                  </p>
                </div>
                <a
                  href={pagePath(lang, `/live/${event.slug}/`)}
                  class="virya-button virya-button--secondary min-h-[42px] px-4"
                >
                  {SIGNAL_COPY[lang].events.details}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div class="grid gap-3 sm:grid-cols-2">
        <a
          href={pagePath(lang, "/area/")}
          class="virya-panel group flex min-h-[96px] items-center justify-between p-5 hover:border-amber-400/50"
        >
          <span class="text-sm font-black uppercase tracking-widest text-white group-hover:text-amber-400">
            {copy.openArea}
          </span>
          <span class="text-2xl text-amber-400" aria-hidden="true">
            →
          </span>
        </a>
        <a
          href={pagePath(lang, "/merch/")}
          class="group flex min-h-[96px] items-center justify-between bg-amber-400 p-5 hover:bg-amber-300"
        >
          <span class="text-sm font-black uppercase tracking-widest text-black">
            {copy.openStore}
          </span>
          <span class="text-2xl text-black" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </div>
  )
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatDate(value: string, locale: string): string {
  return formatWithCache(value, locale, dateTimeFormatters, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateOnly(value: string, locale: string): string {
  return formatWithCache(value, locale, dateOnlyFormatters)
}

function formatWithCache(
  value: string,
  locale: string,
  cache: Map<string, Intl.DateTimeFormat>,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  let formatter = cache.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    cache.set(locale, formatter)
  }
  return formatter.format(date)
}
