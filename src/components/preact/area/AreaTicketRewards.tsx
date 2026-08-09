import { useEffect, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import { safeFormatDate } from "../../../lib/safeDateFormat"

const dateFormatters = {
  pl: new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }),
} as const

type Reward = {
  eventSlug: string
  title: string
  startsAt: string | null
  credits: number
}

type Claim = {
  eventSlug: string
  publicReference: string | null
  issuedAt: string | null
}

type ListResponse = {
  authenticated: boolean
  rewards: Reward[]
  claims: Claim[]
  error?: string
}

const copy = {
  pl: {
    eyebrow: "VIRYA AREA // DARMOWA WEJŚCIÓWKA",
    heading: "Odkryty sygnał może otworzyć bramkę",
    body: "Wymień VIRYA Credits na prawdziwą wejściówkę z tego samego systemu co płatne bilety. Podaj e-mail aktywny w Virya Signal — na niego wyślemy prywatny link i QR.",
    email: "E-mail w Virya Signal",
    claim: "Odbierz wejściówkę",
    working: "Rezerwuję wejściówkę…",
    login: "Najpierw zaloguj profil gracza w sekcji wyżej.",
    signal: "Ten e-mail nie jest jeszcze aktywny w Signal. Zapisz się i potwierdź wiadomość, potem ponów ten sam request.",
    unavailable: "Ta wejściówka nie jest już dostępna.",
    error: "Nie udało się teraz przyznać wejściówki. Spróbuj ponownie tym samym przyciskiem.",
    claimed: "Wejściówka już przyznana",
    credits: "VIRYA Credits",
  },
  en: {
    eyebrow: "VIRYA AREA // FREE PASS",
    heading: "A recovered signal can open the gate",
    body: "Exchange VIRYA Credits for a real admission pass issued by the same system as paid tickets. Use an e-mail already active in Virya Signal — that address receives the private claim link and QR.",
    email: "Virya Signal e-mail",
    claim: "Claim free pass",
    working: "Reserving your pass…",
    login: "Sign in to your player profile above first.",
    signal: "This e-mail is not active in Signal yet. Join and confirm it, then retry the same request.",
    unavailable: "This pass is no longer available.",
    error: "The pass could not be issued right now. Retry with the same button.",
    claimed: "Pass already issued",
    credits: "VIRYA Credits",
  },
} as const

const REQUEST_TIMEOUT_MS = 10_000

const requestKey = (eventSlug: string) => `virya-area-ticket-request:${eventSlug}`

const requestId = (eventSlug: string) => {
  const existing = sessionStorage.getItem(requestKey(eventSlug))
  if (existing) return existing
  const created = crypto.randomUUID()
  sessionStorage.setItem(requestKey(eventSlug), created)
  return created
}

export default function AreaTicketRewards({ lang }: { lang: Lang }) {
  const text = copy[lang]
  const [data, setData] = useState<ListResponse | null>(null)
  const [email, setEmail] = useState("")
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    void fetch("/api/area/tickets", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
      .then(async response => {
        const result = await response.json() as ListResponse
        if (!response.ok) throw new Error(result.error || text.error)
        setData(result)
      })
      .catch(() => setData({ authenticated: false, rewards: [], claims: [], error: text.error }))
  }

  useEffect(load, [])

  if (!data || data.rewards.length === 0) return null
  const claimed = new Set(data.claims.map(item => item.eventSlug))

  const claim = async (reward: Reward) => {
    if (!data.authenticated || working) return
    setWorking(reward.eventSlug)
    setMessage(null)
    try {
      const response = await fetch("/api/area/tickets", {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          requestId: requestId(reward.eventSlug),
          eventSlug: reward.eventSlug,
          email,
          lang,
        }),
      })
      const result = await response.json() as { winnerUrl?: string; code?: string; error?: string }
      if (!response.ok || !result.winnerUrl) {
        if (result.code === "SIGNAL_REQUIRED") throw new Error(text.signal)
        if (result.code === "TICKET_UNAVAILABLE") throw new Error(text.unavailable)
        throw new Error(result.error || text.error)
      }
      sessionStorage.removeItem(requestKey(reward.eventSlug))
      location.assign(result.winnerUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error)
      setWorking(null)
    }
  }

  return (
    <section class="mt-6 overflow-hidden border border-amber-400/45 bg-amber-400/[.045]">
      <div class="grid gap-px bg-zinc-800 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.55fr)]">
        <div class="bg-zinc-950 p-5 sm:p-7">
          <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">{text.eyebrow}</p>
          <h3 class="mt-3 text-2xl font-black uppercase leading-tight text-white">{text.heading}</h3>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">{text.body}</p>
          <label class="mt-5 grid max-w-xl gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
            {text.email}
            <input
              type="email"
              required
              autocomplete="email"
              maxLength={320}
              value={email}
              onInput={event => setEmail(event.currentTarget.value)}
              class="min-h-[48px] border border-zinc-700 bg-zinc-900 px-4 text-sm normal-case tracking-normal text-white"
            />
          </label>
          {!data.authenticated && <p class="mt-4 text-xs font-semibold text-amber-300">{text.login}</p>}
          {message && <p class="mt-4 text-xs font-semibold text-red-300" role="alert">{message}</p>}
        </div>
        <div class="grid content-center gap-3 bg-zinc-950 p-5 sm:p-7">
          {data.rewards.map(reward => {
            const alreadyClaimed = claimed.has(reward.eventSlug)
            const date = reward.startsAt
              ? safeFormatDate(reward.startsAt, dateFormatters[lang])
              : null
            return (
              <article key={reward.eventSlug} class="border border-zinc-800 bg-zinc-900/50 p-4">
                <h4 class="text-sm font-black uppercase text-white">{reward.title}</h4>
                {date && <p class="mt-2 text-[10px] text-zinc-400">{date}</p>}
                <p class="mt-2 text-[9px] font-black uppercase tracking-widest text-amber-400">{reward.credits} {text.credits}</p>
                <button
                  type="button"
                  disabled={!data.authenticated || !email || working !== null || alreadyClaimed}
                  onClick={() => void claim(reward)}
                  class="mt-4 min-h-[46px] w-full bg-amber-400 px-4 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {alreadyClaimed ? text.claimed : working === reward.eventSlug ? text.working : text.claim}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
