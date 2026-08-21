import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import AudienceIntelligence from "./AudienceIntelligence"
import {
  type EventItem,
  type LoadState,
  type Overview,
  type Tab,
  api,
  tabs,
} from "./adminConsoleShared"
import {
  AdmissionTab,
  OverviewTab,
  SignalTab,
  StatusCard,
} from "./AdminConsoleTabs"
import { TicketingTab } from "./AdminTicketingTab"
import { staffLogoutButton } from "./staffButtons"

export default function AdminConsole() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const events = useMemo(() => {
    const unique = new Map<string, EventItem>()
    for (const event of overview?.publicEvents ?? [])
      unique.set(event.slug, event)
    for (const event of overview?.operations.events ?? [])
      unique.set(event.slug, event)
    return [...unique.values()].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )
  }, [overview])

  useEffect(() => {
    const controller = new AbortController()
    void checkSession(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
    if (tabs.some(item => item.key === requested)) setTab(requested as Tab)
  }, [])

  async function checkSession(signal?: AbortSignal) {
    try {
      const status = await api<{
        authenticated: boolean
        configured: boolean
      }>("/api/staff/admin/status", { signal })
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
      await loadOverview(signal)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setState("error")
    }
  }

  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/qr/login", { method: "POST", body: { password } })
      setPassword("")
      await checkSession()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Logowanie nie powiodło się",
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
      setOverview(null)
      setState("login")
      setBusy(false)
    }
  }

  async function loadOverview(signal?: AbortSignal) {
    setOverviewLoading(true)
    setMessage("")
    try {
      setOverview(await api<Overview>("/api/staff/admin/overview", { signal }))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać danych panelu",
        )
      }
    } finally {
      if (!signal?.aborted) setOverviewLoading(false)
    }
  }

  if (state === "checking") return <StatusCard title="Sprawdzam dostęp…" loading />
  if (state === "unconfigured")
    return (
      <StatusCard
        title="Panel nie jest skonfigurowany"
        body="Dostęp Staff nie jest jeszcze skonfigurowany. Skontaktuj się z administratorem VIRYA."
      />
    )
  if (state === "error")
    return (
      <StatusCard
        title="Panel jest chwilowo niedostępny"
        body="Odśwież stronę. Jeśli problem wraca, zgłoś go administratorowi VIRYA."
      />
    )
  if (state === "login") {
    return (
      <section class="mx-auto max-w-lg rounded-xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
          VIRYA // STAFF
        </p>
        <h1 class="mt-3 text-3xl font-black text-white">
          Panel zespołu
        </h1>
        <p class="mt-3 text-sm leading-6 text-zinc-400">
          Koncerty, fani, sprzedaż i komunikacja w jednym miejscu. Sesja wygasa po 12 godzinach.
        </p>
        <form onSubmit={login} class="mt-6 grid gap-4">
          <label class="text-sm font-semibold text-zinc-200">
            Hasło
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
            {busy ? "Loguję…" : "Wejdź do panelu"}
          </button>
        </form>
        {message && (
          <p
            role="alert"
            class="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
          >
            {message}
          </p>
        )}
      </section>
    )
  }

  return (
    <section class="grid gap-5">
      <header class="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
              VIRYA // STAFF
            </p>
            <h1 class="mt-2 text-3xl font-black text-white sm:text-4xl">
              Dzisiaj w VIRYA
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Najbliższe koncerty, aktywne akcje i rzeczy, które wymagają decyzji zespołu.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              disabled={busy || overviewLoading}
              onClick={() => void loadOverview()}
              class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {overviewLoading ? "Odświeżam…" : "Odśwież"}
            </button>
            <button
              disabled={busy}
              onClick={() => void logout()}
              class={staffLogoutButton}
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Sekcje panelu"
        class="flex gap-1 overflow-x-auto border-y border-white/10 bg-black/20 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            class={`min-h-12 shrink-0 border-b-2 px-4 py-2 text-left transition ${tab === item.key ? "border-amber-400 bg-amber-400/[.08] text-white" : "border-transparent text-zinc-400 hover:border-zinc-700 hover:text-white"}`}
          >
            <strong class="block text-sm">{item.label}</strong>
            <span
              class="mt-0.5 block text-[11px] text-zinc-500"
            >
              {item.hint}
            </span>
          </button>
        ))}
      </nav>

      {message && (
        <div
          role="status"
          class="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
          {message}
        </div>
      )}

      {tab === "overview" && (
        <OverviewTab overview={overview} loading={overviewLoading} />
      )}
      {tab === "signal" && <SignalTab />}
      {tab === "audience" && <AudienceIntelligence />}
      {tab === "ticketing" && <TicketingTab events={events} />}
      {tab === "admission" && <AdmissionTab events={events} />}
    </section>
  )
}
