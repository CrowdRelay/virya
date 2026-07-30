import { useEffect, useMemo, useState } from "preact/hooks"
import { SIGNAL_COPY } from "../../../data/signalCopy"
import type { Lang } from "../../../i18n/t"
import type {
  FanEventInterest,
  ReferralProgress,
} from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"

interface Props {
  lang: Lang
}

type State =
  | { kind: "loading" }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | {
      kind: "ready"
      progress: ReferralProgress
      events: FanEventInterest[]
    }

export default function MySignal({ lang }: Props) {
  const copy = SIGNAL_COPY[lang].account
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const [state, setState] = useState<State>({ kind: "loading" })
  const [copied, setCopied] = useState(false)
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      crowdrelay.getReferralProgress(),
      crowdrelay.listMyEvents(),
    ])
      .then(([progress, events]) => {
        if (!cancelled) setState({ kind: "ready", progress, events })
      })
      .catch(error => {
        if (cancelled) return
        if (error instanceof CrowdRelayError && error.status === 401) {
          setState({ kind: "unauthorized" })
        } else {
          setState({ kind: "error" })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const referralUrl = useMemo(() => {
    if (state.kind !== "ready" || !state.progress.referral_code) return null
    return `https://www.virya.music/r/${encodeURIComponent(
      state.progress.referral_code,
    )}`
  }, [state])

  async function copyReferral() {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
    } catch {
      setCopied(false)
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
    return (
      <div class="virya-panel relative overflow-hidden border-amber-400/30 bg-amber-400/[.035] p-6 sm:p-8">
        <div class="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"></div>
        <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
          {copy.eyebrow}
        </p>
        <h2 class="mt-3 max-w-2xl text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
          {state.kind === "unauthorized"
            ? copy.unauthorizedTitle
            : copy.heading}
        </h2>
        <p class="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 text-justify mobile-justify">
          {state.kind === "unauthorized"
            ? copy.unauthorizedBody
            : SIGNAL_COPY[lang].form.loadError}
        </p>
        <a
          href={pagePath(lang, "/signal/#join-signal")}
          class="virya-button virya-button--primary mt-6 min-h-[46px] px-5"
        >
          {copy.join}
        </a>
      </div>
    )
  }

  const { progress, events } = state
  const drawEntries = progress.draw_entries ?? []
  const coupons = progress.coupons ?? []
  const physicalRewards = progress.physical_rewards ?? []

  return (
    <div class="grid gap-6">
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
              <li
                key={draw.draw_id}
                class="virya-panel p-5"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-[8px] font-black uppercase tracking-[.24em] text-zinc-500">
                      {draw.prize_kind === "admission_pass"
                        ? lang === "pl" ? "Wejściówki" : "Guest list"
                        : lang === "pl" ? "Album / nagroda fizyczna" : "Album / physical prize"}
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
                  {copy.drawEntries(draw.total_entries)} · {copy.drawReferrals(draw.qualified_referrals)}
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
                    {copy.rewardExpires}: {formatDate(reward.expires_at, locale)}
                  </p>
                )}
              </li>
            ))}
            {coupons.map(coupon => (
              <li class="border border-zinc-800 bg-zinc-900/50 p-4" key={coupon.id}>
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
                    {event.city?.name ?? event.venue ?? "Virya"} · {new Intl.DateTimeFormat(locale).format(new Date(interested_at))}
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
          <span class="text-2xl text-amber-400" aria-hidden="true">→</span>
        </a>
        <a
          href={pagePath(lang, "/merch/")}
          class="group flex min-h-[96px] items-center justify-between bg-amber-400 p-5 hover:bg-amber-300"
        >
          <span class="text-sm font-black uppercase tracking-widest text-black">
            {copy.openStore}
          </span>
          <span class="text-2xl text-black" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}

function pagePath(lang: Lang, path: string): string {
  return lang === "pl" ? `/pl${path}` : path
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
