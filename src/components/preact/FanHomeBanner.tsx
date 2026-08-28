import { useEffect, useState } from "preact/hooks"
import type { Lang } from "../../i18n/t"
import type { FanHomeSnapshot } from "../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../lib/crowdrelay-client"
import { crowdrelay } from "../../lib/crowdrelay"

interface Props {
  lang: Lang
}

type State =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "ready"; home: FanHomeSnapshot }
  | { kind: "error" }

const RECOMMENDED_ACTION_LABELS: Record<string, { pl: string; en: string }> = {
  open_wallet: { pl: "Twoje bilety są gotowe", en: "Your tickets are ready" },
  open_live_event: { pl: "Masz bilet na następny koncert", en: "You have a ticket for the next show" },
  get_ticket: { pl: "Bilety dostępne", en: "Tickets available" },
  continue_synesthesia: { pl: "Kontynuuj podróż Synesthesia", en: "Continue your Synesthesia journey" },
  follow_next_event: { pl: "Zapisz następny koncert", en: "Follow the next show" },
  share_post_show_feedback: { pl: "Podziel się echem po koncercie", en: "Share a post-show echo" },
  explore_signal: { pl: "Odkryj swój Sygnał", en: "Explore your Signal" },
}

const formatDate = (value: string, locale: string, timezone?: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone && timezone.trim() !== "" ? timezone : undefined,
  }).format(date)
}

const pagePath = (lang: Lang, path: string): string =>
  lang === "pl" ? `/pl${path}` : path

export default function FanHomeBanner({ lang }: Props) {
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let cancelled = false
    void crowdrelay
      .getFanHome()
      .then(home => {
        if (!cancelled) setState({ kind: "ready", home })
      })
      .catch(error => {
        if (cancelled) return
        if (error instanceof CrowdRelayError && error.status === 401) {
          setState({ kind: "anonymous" })
        } else {
          // Fail open: a transient CrowdRelay outage must not break the homepage.
          setState({ kind: "error" })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Anonymous visitors and transient errors render nothing — the generic
  // homepage shows unchanged. This keeps the banner invisible to first-time
  // visitors and during CrowdRelay outages.
  if (state.kind === "loading" || state.kind === "anonymous" || state.kind === "error") {
    return null
  }

  const { home } = state
  const nextEvent = home.next_event
  const actionLabel = RECOMMENDED_ACTION_LABELS[home.recommended_action]
  const actionText = actionLabel
    ? actionLabel[lang]
    : RECOMMENDED_ACTION_LABELS.explore_signal[lang]

  // The referral CTA is only useful if the fan has a referral code.
  const showReferral = home.referral.qualified > 0 || home.referral.pending > 0

  return (
    <section
      class="border-b border-amber-400/20 bg-amber-400/[.025]"
      role="status"
      aria-label={lang === "pl" ? "Twój Sygnał" : "Your Signal"}
    >
      <div class="virya-section__inner virya-section--compact py-5 sm:py-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
              {lang === "pl" ? "VIRYA // TWÓJ SYGNAŁ" : "VIRYA // YOUR SIGNAL"}
            </p>
            <p class="mt-2 text-sm font-bold text-white sm:text-base">
              {actionText}
            </p>
            {nextEvent && (
              <p class="mt-1 text-xs text-zinc-400">
                {nextEvent.title} · {[nextEvent.city, nextEvent.venue].filter(Boolean).join(" · ")} ·{" "}
                {formatDate(nextEvent.starts_at, locale)}
              </p>
            )}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            {nextEvent && (
              <a
                href={pagePath(lang, `/live/${nextEvent.slug}/`)}
                class="virya-button virya-button--primary min-h-[44px] px-4 text-[10px]"
              >
                {home.recommended_action === "open_wallet"
                  ? lang === "pl" ? "TWOJE BILETY" : "YOUR TICKETS"
                  : lang === "pl" ? "OTWÓRZ KONCERT" : "OPEN SHOW"}
                <span aria-hidden="true">→</span>
              </a>
            )}
            {showReferral && (
              <a
                href={pagePath(lang, "/my-signal/")}
                class="virya-button virya-button--secondary min-h-[44px] px-4 text-[10px]"
              >
                {lang === "pl"
                  ? `${home.referral.qualified} POLECEŃ`
                  : `${home.referral.qualified} REFERRALS`}
              </a>
            )}
            {!nextEvent && (
              <a
                href={pagePath(lang, "/my-signal/")}
                class="virya-button virya-button--secondary min-h-[44px] px-4 text-[10px]"
              >
                {lang === "pl" ? "MÓJ SYGNAŁ" : "MY SIGNAL"}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
