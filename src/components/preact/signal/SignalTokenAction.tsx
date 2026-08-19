import { useEffect, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import {
  clearPendingConcertCheckin,
  clearSynesthesiaHandoff,
  crowdrelay,
  getPendingConcertCheckin,
  readFragmentToken,
  synesthesiaHandoffFromLocation,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
  action: "confirm" | "unsubscribe"
}

type State = "working" | "success" | "error"

export default function SignalTokenAction({ lang, action }: Props) {
  const copy = SIGNAL_COPY[lang].action
  const [state, setState] = useState<State>("working")
  const [message, setMessage] = useState(
    action === "confirm" ? copy.confirmWorking : copy.unsubscribeWorking,
  )
  const [email, setEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  useEffect(() => {
    const token = readFragmentToken()
    if (!token) {
      setState("error")
      setMessage(copy.missingToken)
      return
    }

    let cancelled = false
    const request =
      action === "confirm"
        ? crowdrelay.confirmFan(token)
        : crowdrelay.unsubscribeFan(token)

    void request
      .then(async () => {
        if (cancelled) return
        setState("success")
        setMessage(
          action === "confirm" ? copy.confirmSuccess : copy.unsubscribeSuccess,
        )

        if (action !== "confirm") return

        // Fan confirmation establishes the authenticated web session. If the
        // signup was reached from a completed Synesthesia run, continue that
        // process immediately instead of requiring an extra visit to My Signal.
        // Transient failures intentionally keep the short-lived handoff so My
        // Signal / SignalHub can retry it; only success or terminal rejection
        // consumes the capability.
        const handoff = synesthesiaHandoffFromLocation()
        if (handoff) {
          try {
            await crowdrelay.linkSynesthesiaCompletion(handoff)
            if (cancelled) return
            clearSynesthesiaHandoff()
          } catch (error) {
            if (cancelled) return
            if (
              error instanceof CrowdRelayError &&
              [404, 409, 422].includes(error.status)
            ) {
              clearSynesthesiaHandoff()
            }
          }
        }

        const pending = getPendingConcertCheckin()
        if (!pending) return
        try {
          const result = await crowdrelay.checkInToEvent(
            pending.slug,
            pending.token,
          )
          if (cancelled) return
          clearPendingConcertCheckin()
          setMessage(
            `${copy.confirmSuccess} ${
              result.created
                ? SIGNAL_COPY[lang].event.checkinSuccess
                : SIGNAL_COPY[lang].event.checkinAlready
            }`,
          )
        } catch (error) {
          if (cancelled) return
          if (error instanceof CrowdRelayError && error.status === 404) {
            clearPendingConcertCheckin()
            setMessage(
              `${copy.confirmSuccess} ${SIGNAL_COPY[lang].event.checkinExpired}`,
            )
            return
          }
          if (error instanceof CrowdRelayError && error.status === 409) {
            clearPendingConcertCheckin()
            setMessage(
              `${copy.confirmSuccess} ${SIGNAL_COPY[lang].event.checkinFull}`,
            )
            return
          }
          setMessage(
            `${copy.confirmSuccess} ${SIGNAL_COPY[lang].event.checkinError}`,
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        setState("error")
        setMessage(
          action === "confirm" ? copy.confirmError : copy.unsubscribeError,
        )
      })

    return () => {
      cancelled = true
    }
  }, [action, copy, lang])

  async function resendAccess(event: SubmitEvent) {
    event.preventDefault()
    const normalized = email.trim()
    if (!normalized || resending) return
    setResending(true)
    try {
      await crowdrelay.requestFanAccess(normalized, lang)
      setResendDone(true)
      setMessage(
        lang === "pl"
          ? "Jeśli ten e-mail jest zapisany w Virya Signal, wysłaliśmy nowy link. Możesz ustawić nowy PIN na tym lub innym urządzeniu."
          : "If this email belongs to Virya Signal, we sent a new link. You can set a new PIN on this or another device.",
      )
    } catch {
      setMessage(
        lang === "pl"
          ? "Nie udało się teraz wysłać linku. Spróbuj ponownie za chwilę."
          : "We could not send the link right now. Please try again shortly.",
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <section
      class={`relative overflow-hidden border p-6 sm:p-8 ${
        state === "error"
          ? "border-red-400/35 bg-red-400/[.035]"
          : "border-amber-400/35 bg-amber-400/[.035]"
      }`}
      aria-busy={state === "working"}
    >
      <div class="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"></div>
      <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
        {lang === "pl" ? "VIRYA // SYGNAŁ" : "VIRYA // SIGNAL"}
      </p>
      <h1 class="mt-4 text-3xl font-black uppercase leading-tight text-white">
        {action === "confirm" ? copy.confirmTitle : copy.unsubscribeTitle}
      </h1>
      <p class="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-300" role="status" aria-live="polite">
        {message}
      </p>
      {state === "error" && action === "confirm" && (
        <form onSubmit={resendAccess} class="mt-6 max-w-md">
          <label class="block text-xs font-black uppercase tracking-wider text-zinc-300">
            {lang === "pl" ? "E-mail konta" : "Account email"}
            <input
              type="email"
              autocomplete="email"
              value={email}
              onInput={event => setEmail((event.currentTarget as HTMLInputElement).value)}
              class="mt-2 min-h-12 w-full border border-white/15 bg-black/40 px-4 text-sm text-white outline-none focus:border-amber-400"
              required
            />
          </label>
          <button
            type="submit"
            disabled={resending || resendDone}
            class="virya-button virya-button--primary mt-3 min-h-[46px] px-5 disabled:opacity-50"
          >
            {resending
              ? lang === "pl" ? "WYSYŁAM…" : "SENDING…"
              : resendDone
                ? lang === "pl" ? "LINK WYSŁANY" : "LINK SENT"
                : lang === "pl" ? "WYŚLIJ NOWY LINK" : "SEND A NEW LINK"}
          </button>
        </form>
      )}
      <div class="mt-7 flex flex-wrap gap-3">
        {state === "success" && action === "confirm" && (
          <a
            href={pagePath(lang, "/my-signal/")}
            class="virya-button virya-button--primary min-h-[46px] px-5"
          >
            {copy.account}
          </a>
        )}
        <a
          href={pagePath(lang, "/")}
          class="virya-button virya-button--secondary min-h-[46px] px-5"
        >
          {copy.home}
        </a>
      </div>
    </section>
  )
}

function pagePath(lang: Lang, path: string): string {
  if (path === "/") return lang === "pl" ? "/pl/" : "/"
  return lang === "pl" ? `/pl${path}` : path
}
