import { captureContextForPage } from "../../../lib/signalCaptureContext"
import { useEffect, useMemo, useState } from "preact/hooks"
import { createSignalSignupSubmitter, signalSignupInput } from "../../../lib/signalSignup"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import { t } from "../../../i18n/t"
import {
  rememberLandingAttribution,
  signupAttribution,
} from "../../../lib/signupAttribution"
import {
  campaignIdFromLocation,
  crowdrelay,
  referralCodeFromLocation,
} from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
}

type SubmitState = "idle" | "saving" | "pending" | "saved" | "error"

// Capture a consented email under the video. City enrichment never blocks signup.
export default function WatchJoin({ lang }: Props) {
  const copy = SIGNAL_COPY[lang]
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [submitMessage, setSubmitMessage] = useState("")
  const [referralUrl, setReferralUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const submitSignup = useMemo(() => createSignalSignupSubmitter(crowdrelay), [])

  useEffect(() => {
    rememberLandingAttribution()
  }, [])

  async function join(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const email = String(data.get("email") ?? "").trim()
    const consent = data.get("consent") === "on"

    if (!email || !consent) {
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
      const attribution = signupAttribution()
      const result = await submitSignup(signalSignupInput(email, locale, consent, {
        capture_context: captureContextForPage(window.location.pathname, window.location.search),
        ...(campaignId ? { campaign_id: campaignId } : {}),
        ...(referralCode ? { referral_code: referralCode } : {}),
        ...(attribution ? { ad_attribution: attribution } : {}),
      }))

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
    } catch {
      setSubmitState("error")
      setSubmitMessage(copy.form.saveError)
    }
  }

  async function shareReferral() {
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
    } catch {
      // A dismissed share sheet is not an error worth surfacing.
    }
  }

  return (
    <div>
      <h2 class="text-lg font-black uppercase tracking-widest text-white">
        {t(lang, "watch.heading")}
      </h2>
      <p class="mt-2 text-sm leading-relaxed text-zinc-400">
        {t(lang, "watch.body")}
      </p>

      <form onSubmit={join} noValidate class="mt-5 grid gap-4">
        <label class="block">
          <span class="text-[9px] font-black uppercase tracking-[.24em] text-zinc-400">
            {copy.form.email}
          </span>
          <input
            name="email"
            type="email"
            required
            autocomplete="email"
            disabled={submitState === "saving"}
            class="virya-input mt-2 min-h-[50px] bg-zinc-900 px-4 text-sm disabled:opacity-60"
          />
        </label>
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
        <button
          type="submit"
          disabled={submitState === "saving"}
          class="virya-button virya-button--primary min-h-[48px] px-4 disabled:cursor-wait"
        >
          {submitState === "saving"
            ? copy.form.saving
            : t(lang, "watch.join")}
        </button>
      </form>

      {submitState !== "idle" && submitState !== "saving" && (
        <div
          class={`mt-4 border p-5 ${
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
          {referralUrl && (
            <div class="mt-5">
              <p class="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {copy.form.referralTitle}
              </p>
              <button
                type="button"
                onClick={shareReferral}
                class="virya-button virya-button--secondary mt-2 min-h-[44px] px-4"
              >
                {copied ? copy.form.copied : copy.form.copy}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
