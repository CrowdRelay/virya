import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import {
  REQUEST_TIMEOUT_MS,
  type EventItem,
  type LoadState,
  type Overview,
  type Tab,
  api,
  tabs,
} from "./adminConsoleShared"
import { bootstrapStaffPanel } from "./staffApi"
import {
  AdmissionTab,
  OverviewTab,
  SignalTab,
  StatusCard,
} from "./AdminConsoleTabs"
import LazyPanel, { type Panel, warmPanel } from "./LazyPanel"
import { staffAccentButton, staffLogoutButton, staffSecondaryButton } from "./staffButtons"

// The three heaviest sections are fetched the first time they are opened.
// Keeping them out of the console's first script is what makes "Dzisiaj"
// interactive without also parsing ticketing, Fan 360 and the Latarnik network.
type LazyTab = "audience" | "ticketing" | "beacons"
const LAZY: Record<LazyTab, { label: string; load: () => Promise<Panel> }> = {
  audience: {
    label: "Pobieram Fan 360…",
    load: () => import("./AudienceIntelligence").then(module => module.default as Panel),
  },
  ticketing: {
    label: "Pobieram sprzedaż biletów…",
    load: () => import("./AdminTicketingTab").then(module => module.TicketingTab as Panel),
  },
  beacons: {
    label: "Pobieram sieć Latarników…",
    load: () => import("./StaffBeaconsManager").then(module => module.default as Panel),
  },
}
const isLazy = (value: Tab): value is LazyTab => value in LAZY

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

  // The sidebar and the address bar both have to follow the section the
  // operator is actually looking at, otherwise a reload or a shared link
  // lands somewhere else than the highlighted entry.
  const openTab = useCallback((next: Tab) => {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === "overview") url.searchParams.delete("tab")
    else url.searchParams.set("tab", next)
    window.history.replaceState(null, "", `${url.pathname}${url.search}`)
    dispatchEvent(new CustomEvent("staff:tab", { detail: next }))
  }, [])

  async function checkSession(signal?: AbortSignal) {
    // The overview answers the session question itself, so opening the panel is
    // one function invocation instead of a status call and then a data call.
    setOverviewLoading(true)
    setMessage("")
    const result = await bootstrapStaffPanel<Overview>("/api/staff/admin/overview", {
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    })
    if (signal?.aborted) return
    setOverviewLoading(false)
    if (result.state === "ready" && result.data) {
      setOverview(result.data)
      setState("ready")
      return
    }
    setState(result.state === "ready" ? "error" : result.state)
    if (result.state === "login") {
      queueMicrotask(() => passwordRef.current?.focus())
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
            class={staffAccentButton}
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
      <header class="border-b border-zinc-800 pb-6">
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
              class={staffSecondaryButton}
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
            onClick={() => openTab(item.key)}
            onPointerEnter={() => {
              if (isLazy(item.key)) void warmPanel(item.key, LAZY[item.key].load)
            }}
            onFocus={() => {
              if (isLazy(item.key)) void warmPanel(item.key, LAZY[item.key].load)
            }}
            aria-current={tab === item.key ? "page" : undefined}
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
      {tab === "admission" && <AdmissionTab events={events} />}
      {isLazy(tab) && (
        <LazyPanel
          id={tab}
          label={LAZY[tab].label}
          load={LAZY[tab].load}
          props={tab === "ticketing" ? { events } : tab === "beacons" ? { embedded: true } : {}}
        />
      )}
    </section>
  )
}
