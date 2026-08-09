import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { generateQr, type GeneratedQr } from "../../../lib/qrCode"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type ApiError = Error & { status?: number }

type PairingEnvelope = {
  version: 1
  role: "staff"
  displayName: string
  expiresAt: number
  uri: string
}

type ApiOptions = {
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
}

const api = async <T,>(path: string, options: ApiOptions = {}): Promise<T> => {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal ?? AbortSignal.timeout(10_000),
    headers: options.body === undefined
      ? { Accept: "application/json" }
      : { Accept: "application/json", "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    const error = new Error("Request failed") as ApiError
    error.status = response.status
    throw error
  }
  return await response.json() as T
}

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

export default function StaffPairingManager() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("Virya staff")
  const [ttlMinutes, setTtlMinutes] = useState(5)
  const [envelope, setEnvelope] = useState<PairingEnvelope | null>(null)
  const [qr, setQr] = useState<GeneratedQr | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const passwordRef = useRef<HTMLInputElement>(null)

  const expired = envelope !== null && secondsLeft <= 0
  const expiryLabel = useMemo(
    () => envelope
      ? new Intl.DateTimeFormat("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(envelope.expiresAt * 1000))
      : "",
    [envelope],
  )

  useEffect(() => {
    const controller = new AbortController()
    void checkStatus(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!envelope) {
      setSecondsLeft(0)
      return
    }
    const update = () => {
      const remaining = Math.max(
        0,
        envelope.expiresAt - Math.floor(Date.now() / 1000),
      )
      setSecondsLeft(remaining)
      if (remaining === 0) {
        setQr(null)
      }
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [envelope])

  async function checkStatus(signal?: AbortSignal) {
    try {
      const status = await api<{ authenticated: boolean; configured: boolean }>(
        "/api/staff/pairing",
        { signal },
      )
      if (!status.configured) {
        setState("unconfigured")
        return
      }
      if (!status.authenticated) {
        setState("login")
        queueMicrotask(() => passwordRef.current?.focus())
        return
      }
      setState("ready")
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setState("error")
      }
    }
  }

  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/qr/login", {
        method: "POST",
        body: { password },
      })
      setPassword("")
      await checkStatus()
    } catch (error) {
      setMessage(
        (error as ApiError).status === 429
          ? "Za dużo prób. Spróbuj ponownie za kilkanaście minut."
          : "Nieprawidłowe hasło.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await api("/api/staff/qr/logout", { method: "POST", body: {} })
    } finally {
      clearPairing()
      setState("login")
      setBusy(false)
    }
  }

  async function generate(event: SubmitEvent) {
    event.preventDefault()
    if (busy || displayName.trim().length < 2) return
    setBusy(true)
    setMessage("")
    try {
      const next = await api<PairingEnvelope>("/api/staff/pairing", {
        method: "POST",
        body: { displayName, ttlMinutes },
      })
      const generated = generateQr(next.uri)
      setEnvelope(next)
      setQr(generated)
    } catch (error) {
      const status = (error as ApiError).status
      if (status === 401) {
        clearPairing()
        setState("login")
        setMessage("Sesja wygasła. Zaloguj się ponownie.")
      } else if (status === 422) {
        setMessage("Sprawdź nazwę urządzenia i czas ważności.")
      } else {
        setMessage("Nie udało się wygenerować kodu parowania.")
      }
    } finally {
      setBusy(false)
    }
  }

  function clearPairing() {
    setEnvelope(null)
    setQr(null)
    setSecondsLeft(0)
  }

  if (state === "checking") return <StatusCard title="Sprawdzam dostęp…" />
  if (state === "unconfigured") {
    return (
      <StatusCard
        title="Parowanie nie jest skonfigurowane"
        body="Ustaw w Netlify server-only klucz operatora staff oraz istniejące zmienne logowania panelu. Klucz musi odpowiadać konfiguracji staff po stronie CrowdRelay."
      />
    )
  }
  if (state === "error") {
    return (
      <StatusCard
        title="Generator jest chwilowo niedostępny"
        body="Odśwież stronę albo sprawdź logi funkcji Netlify."
      />
    )
  }
  if (state === "login") {
    return (
      <section class="mx-auto max-w-lg rounded-3xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
          Virya Signal / staff
        </p>
        <h1 class="mt-3 text-3xl font-black text-white">Parowanie telefonu</h1>
        <p class="mt-3 text-sm leading-6 text-zinc-400">
          Zaloguj się tym samym hasłem co do QR, bramki i Control Center.
        </p>
        <form onSubmit={login} class="mt-6 grid gap-4">
          <label class="text-sm font-semibold text-zinc-200">
            Hasło staff
            <input
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onInput={event => setPassword(event.currentTarget.value)}
              class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-amber-300"
            />
          </label>
          <button
            disabled={busy || !password}
            class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
          >
            {busy ? "LOGUJĘ…" : "ZALOGUJ"}
          </button>
        </form>
        {message ? <Message>{message}</Message> : null}
      </section>
    )
  }

  return (
    <div class="grid gap-6">
      <section class="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
              Virya Signal / device pairing
            </p>
            <h1 class="mt-3 text-3xl font-black text-white sm:text-4xl">
              Zaloguj telefon jako staff
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              W aplikacji wybierz strefę operatora, naciśnij „Zeskanuj kod QR”,
              zeskanuj kod z tej strony i ustaw lokalny PIN urządzenia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={busy}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            Wyloguj
          </button>
        </div>
      </section>

      <div class="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <form
          onSubmit={generate}
          class="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/70 p-6"
        >
          <h2 class="text-xl font-black text-white">Nowe parowanie</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-500">
            Kod jest przeznaczony dla jednej zaufanej osoby i automatycznie znika
            z ekranu po wygaśnięciu.
          </p>
          <div class="mt-6 grid gap-4">
            <label class="text-sm font-semibold text-zinc-200">
              Nazwa osoby lub urządzenia
              <input
                value={displayName}
                maxLength={64}
                autoComplete="off"
                onInput={event => setDisplayName(event.currentTarget.value)}
                placeholder="np. Kuba — bramka"
                class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-amber-300"
              />
            </label>
            <label class="text-sm font-semibold text-zinc-200">
              Ważność kodu
              <select
                value={ttlMinutes}
                onChange={event => setTtlMinutes(Number(event.currentTarget.value))}
                class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-amber-300"
              >
                <option value={3}>3 minuty</option>
                <option value={5}>5 minut</option>
                <option value={10}>10 minut</option>
              </select>
            </label>
            <button
              disabled={busy || displayName.trim().length < 2}
              class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
            >
              {busy ? "GENERUJĘ…" : "WYGENERUJ QR STAFF"}
            </button>
          </div>
          <div class="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100/80">
            QR zawiera prywatny klucz roli staff wymagany przez obecną wersję
            Virya Signal. Nie wysyłaj zrzutu ekranu i nie pokazuj kodu poza
            zaufanym urządzeniem. Odebranie dostępu wymaga rotacji klucza staff.
          </div>
        </form>

        <section class="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          {!qr || !envelope ? (
            <div class="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <div>
                <div class="text-5xl text-zinc-700" aria-hidden="true">▦</div>
                <h2 class="mt-4 text-xl font-black text-white">Kod nie został wygenerowany</h2>
                <p class="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Nadaj czytelną nazwę urządzeniu i wygeneruj krótkotrwały QR.
                </p>
              </div>
            </div>
          ) : (
            <div class="grid gap-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-zinc-500">Staff</p>
                  <h2 class="mt-1 text-xl font-black text-white">{envelope.displayName}</h2>
                </div>
                <div class={`rounded-xl px-3 py-2 text-right ${expired ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-200"}`}>
                  <div class="text-[10px] font-bold uppercase tracking-wider">{expired ? "Wygasł" : "Pozostało"}</div>
                  <div class="font-mono text-xl font-black tabular-nums">{formatCountdown(secondsLeft)}</div>
                </div>
              </div>
              <div
                class={`mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl bg-white p-4 transition ${expired ? "opacity-15 blur-sm" : ""}`}
                aria-hidden={expired ? "true" : undefined}
                dangerouslySetInnerHTML={{ __html: qr.svg }}
              />
              <p class="text-center text-xs text-zinc-500">
                Ważny do {expiryLabel}. Po wygaśnięciu wygeneruj nowy kod.
              </p>
              <button
                type="button"
                onClick={clearPairing}
                class="w-full rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-200 hover:bg-rose-400/10"
              >
                UKRYJ KOD
              </button>
            </div>
          )}
        </section>
      </div>
      {message ? <Message>{message}</Message> : null}
    </div>
  )
}

function StatusCard({ title, body }: { title: string; body?: string }) {
  return (
    <section class="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/80 p-7">
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
        Virya Signal / staff
      </p>
      <h1 class="mt-3 text-3xl font-black text-white">{title}</h1>
      {body ? <p class="mt-3 text-sm leading-6 text-zinc-400">{body}</p> : null}
    </section>
  )
}

function Message({ children }: { children: string }) {
  return (
    <p
      role="status"
      class="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
    >
      {children}
    </p>
  )
}
