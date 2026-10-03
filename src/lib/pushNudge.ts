// When to ask a signed-in fan to turn notifications on.
//
// Push is the one owned, free, consented and immediate way to bring a fan back
// to the band. On 2026-10-03 production had 20 fans, 14 of whom had opened
// Signal in the last 30 days, and 4 push endpoints (2 active) between them: the
// opt-in lived in a panel near the bottom of My Signal, below history and
// settings, where almost nobody scrolls. This decides when the same opt-in
// should be shown up top instead — and, just as important, when it must not.
//
// Pure on purpose: no browser APIs, so the rule is testable and the component
// stays a thin reader of it.

export const NUDGE_DISMISS_DAYS = 14
export const NUDGE_DISMISS_KEY = "virya-push-nudge-dismissed-at-v1"

const DAY_MS = 24 * 60 * 60 * 1000

export type NudgeInput = {
  /** The browser can do web push at all. */
  supported: boolean
  /** Notification.permission as the browser reports it. */
  permission: "default" | "granted" | "denied"
  /** This device already has a push subscription. */
  subscribed: boolean
  /** When the fan last said "not now" on this device, epoch ms, if ever. */
  dismissedAtMs: number | null
  nowMs: number
}

/**
 * Whether to show the opt-in at the top of My Signal.
 *
 * Never for a blocked browser (asking again cannot work and reads as nagging),
 * never when already subscribed, and never inside the window after a "not now".
 * A permission of `granted` with no subscription is shown: the fan said yes to
 * the browser but this device never registered, which is the cheapest win.
 */
export function shouldNudgePush(input: NudgeInput): boolean {
  if (!input.supported) return false
  if (input.permission === "denied") return false
  if (input.subscribed) return false
  if (input.dismissedAtMs !== null) {
    const age = input.nowMs - input.dismissedAtMs
    // A dismissal from the future is a clock fault, not a reason to hide forever.
    if (age >= 0 && age < NUDGE_DISMISS_DAYS * DAY_MS) return false
  }
  return true
}

/** Parses the stored dismissal; anything that is not a finite time is "never". */
export function parseDismissedAt(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}
