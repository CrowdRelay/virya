import type { ComponentChildren } from "preact"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"
import StaffLatarnikNetworkManager, { type BeaconNetworkOverview } from "./StaffLatarnikNetworkManager"
import StaffLatarnikReleaseManager, { type BeaconReleaseOverview } from "./StaffLatarnikReleaseManager"
import { bootstrapStaffPanel, staffApi, type StaffApiError } from "./staffApi"
import { StaffLoginCard, StaffStatusCard } from "./AdminConsoleUi"
import { staffAccentButton, staffSecondaryButton } from "./staffButtons"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"

const REQUEST_TIMEOUT_MS = 15_000

const api = <T,>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
) => staffApi<T>(path, { ...options, timeoutMs: REQUEST_TIMEOUT_MS })

type InventoryItem = {
  sku: string
  product_name: string
  variant_label: string
  available_quantity: number
  active: boolean
}

type Overview = {
  inventory: { items: InventoryItem[] }
  beaconReleases: BeaconReleaseOverview
  beaconNetwork: BeaconNetworkOverview
}

const EMPTY_NETWORK: BeaconNetworkOverview = {
  discoveryRuns: [],
  pendingCandidates: [],
  approvedCandidates: [],
  inviteJobs: [],
}

const EMPTY_RELEASES: BeaconReleaseOverview = {
  pool: { activeReleaseLatarnicy: 0, contactableLatarnicy: 0, missingEmail: 0 },
  campaigns: [],
  recipients: [],
}

type City = { slug: string; name: string }

// The public city list is the only city source a browser surface may read: it
// carries slugs and no ids, and CrowdRelay resolves the slug when the beacon is
// written. Reading it straight from CrowdRelay keeps the BFF route budget free.
const CITIES_URL = `${(import.meta.env.PUBLIC_CROWDRELAY_API_URL as string | undefined)?.replace(/\/+$/, "") || "https://signal-api.virya.music/v1"}/public/cities?limit=100`

const KINDS: Array<[string, string]> = [
  ["promoter", "Promotor"],
  ["venue", "Klub"],
  ["radio", "Radio"],
  ["local_press", "Prasa lokalna"],
  ["reviewer", "Recenzent"],
  ["creator", "Twórca"],
  ["photographer", "Fotograf"],
  ["scene_partner", "Partner sceny"],
  ["community", "Społeczność"],
]

export default function StaffBeaconsManager({ embedded = false }: { embedded?: boolean } = {}) {
  // Inside the staff console the session is already established, so the panel
  // skips its own status round trip and its own login form.
  const [state, setState] = useState<LoadState>(embedded ? "ready" : "checking")
  const [password, setPassword] = useState("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [testName, setTestName] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [testKind, setTestKind] = useState("promoter")
  const [testCity, setTestCity] = useState("")
  const [cities, setCities] = useState<City[]>([])
  const [inviteUrl, setInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const inventoryItems = useMemo(
    () => (overview?.inventory.items ?? []).filter(item => item.active),
    [overview],
  )

  async function refresh() {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setMessage("")
    try {
      const next = await api<Overview>("/api/staff/commerce/overview", {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setOverview(next)
    } catch (error) {
      if ((error as StaffApiError).status === 401) {
        setState("login")
        setOverview(null)
        setMessage("Sesja wygasła. Zaloguj się ponownie.")
      } else if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage("Nie udało się odświeżyć sieci Latarników.")
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  // Cities only gate the optional home city on a manual beacon, so a failed
  // read leaves the picker empty instead of blocking the panel.
  useEffect(() => {
    const controller = new AbortController()
    void fetch(CITIES_URL, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(response => (response.ok ? response.json() : null))
      .then(payload => {
        const items = Array.isArray(payload?.items) ? payload.items : []
        setCities(items
          .filter((city: City) => typeof city?.slug === "string" && typeof city?.name === "string")
          .map((city: City) => ({ slug: city.slug, name: city.name })))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (embedded) {
      void refresh()
      return () => {
        controller.abort()
        requestRef.current?.abort()
      }
    }
    // One invocation: the overview carries the session verdict with it.
    void bootstrapStaffPanel<Overview>("/api/staff/commerce/overview", {
      signal: controller.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }).then(result => {
      if (controller.signal.aborted) return
      if (result.state === "ready" && result.data) {
        setOverview(result.data)
        setState("ready")
        return
      }
      setState(result.state === "ready" ? "error" : result.state)
      if (result.state === "login") {
        queueMicrotask(() => passwordRef.current?.focus())
      }
    })
    return () => {
      controller.abort()
      requestRef.current?.abort()
    }
  }, [])

  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/qr/login", { method: "POST", body: { password } })
      setPassword("")
      setState("ready")
      await refresh()
    } catch {
      setMessage("Logowanie nie powiodło się.")
    } finally {
      setBusy(false)
    }
  }

  async function mintTestBeacon(event: SubmitEvent) {
    event.preventDefault()
    if (busy || !testName.trim() || !testEmail.trim()) return
    setBusy(true)
    setMessage("")
    setInviteUrl("")
    setCopied(false)
    try {
      const result = await api<{ inviteUrl?: string }>(
        "/api/staff/commerce/campaigns",
        {
          method: "POST",
          body: {
            kind: "beacon_network",
            action: "test_beacon",
            displayName: testName.trim(),
            contactEmail: testEmail.trim(),
            beaconKind: testKind,
            // Distances are measured from the home city; without one the
            // Latarnik's local radar stays empty whatever radius they pick.
            ...(testCity ? { citySlug: testCity } : {}),
          },
        },
      )
      const url = result.inviteUrl ?? ""
      if (!url.startsWith("https://virya.music/")) {
        throw new Error("Nieoczekiwany adres zaproszenia")
      }
      setInviteUrl(url)
      setMessage("Latarnik utworzony. Link zaproszenia jest niżej.")
      await refresh()
    } catch (error) {
      setMessage(
        (error as StaffApiError).payload?.error ??
          "Nie udało się utworzyć testowego Latarnika.",
      )
    } finally {
      setBusy(false)
    }
  }

  if (state === "checking") return <StaffStatusCard title="Sprawdzam dostęp…" />
  if (state === "unconfigured") {
    return <StaffStatusCard title="Panel nie jest skonfigurowany" body="Panel nie ma jeszcze włączonego dostępu. Poproś osobę prowadzącą techniczną stronę o jego konfigurację." />
  }
  if (state === "error") {
    return <StaffStatusCard title="Panel jest chwilowo niedostępny" body="Odśwież stronę za chwilę. Jeśli problem nie zniknie, napisz do osoby prowadzącej techniczną stronę." />
  }
  if (state === "login") {
    return (
      <StaffLoginCard
        eyebrow="Virya / latarnicy"
        title="Sieć Latarników"
        description="Zaloguj się tym samym hasłem co do QR i panelu zespołu."
        passwordRef={passwordRef}
        password={password}
        onPasswordInput={setPassword}
        busy={busy}
        message={message ? { tone: "error", text: String(message) } : null}
        onSubmit={login}
      />
    )
  }

  return (
    <div class="relative grid gap-6">
      {loading && <BackendLoader overlay label="Pobieram sieć Latarników…" />}

      <section class="border-b border-zinc-800 pb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">CrowdRelay / latarnicy</p>
            {embedded
              ? <h2 class="mt-2 text-2xl font-black text-white sm:text-3xl">Sieć Latarników</h2>
              : <h1 class="mt-2 text-3xl font-black text-white sm:text-4xl">Sieć Latarników</h1>}
            <p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Promotorzy, kluby, media i partnerzy sceny. Każdy widzi popyt w swoim
              mieście i materiały prasowe pod ręką.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading || busy}
            class={staffSecondaryButton}>
            ODŚWIEŻ
          </button>
        </div>
        {message ? <Message>{message}</Message> : null}
      </section>

      <section class="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-8">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Test</p>
        <h2 class="mt-1 text-xl font-black text-white">Dodaj Latarnika ręcznie</h2>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Pomija research i review, więc używaj tego wyłącznie dla nas — do
          sprawdzenia, jak sieć wygląda z drugiej strony. Dla obcych kontaktów
          bramka zgody obowiązuje bez wyjątku.
        </p>
        <form onSubmit={mintTestBeacon} class="mt-5 grid gap-3 sm:grid-cols-2 sm:items-end">
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Nazwa
            <input value={testName} onInput={event => setTestName(event.currentTarget.value)}
              placeholder="Wojtek — test"
              class="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-amber-300" />
          </label>
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            E-mail
            <input type="email" value={testEmail} onInput={event => setTestEmail(event.currentTarget.value)}
              placeholder="ty@example.com"
              class="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-amber-300" />
          </label>
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Rodzaj
            <select value={testKind} onChange={event => setTestKind(event.currentTarget.value)}
              class="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-amber-300">
              {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Miasto
            <select value={testCity} onChange={event => setTestCity(event.currentTarget.value)}
              disabled={cities.length === 0}
              class="min-h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-white outline-none focus:border-amber-300 disabled:opacity-50">
              <option value="">{cities.length === 0 ? "Lista miast niedostępna" : "Bez miasta (radar nie działa)"}</option>
              {cities.map(city => <option key={city.slug} value={city.slug}>{city.name}</option>)}
            </select>
          </label>
          <button disabled={busy || !testName.trim() || !testEmail.trim()}
            class={`${staffAccentButton} sm:col-span-2`}>
            {busy ? "TWORZĘ…" : "UTWÓRZ I WYBIJ ZAPROSZENIE"}
          </button>
        </form>
        {inviteUrl ? (
          <div class="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
            <p class="text-[10px] font-black uppercase tracking-wider text-emerald-300">Link zaproszenia</p>
            <p class="mt-2 break-all font-mono text-xs text-emerald-100">{inviteUrl}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <a href={inviteUrl} class="rounded-lg bg-emerald-300 px-4 py-2 text-[10px] font-black text-zinc-950">OTWÓRZ</a>
              <button type="button" onClick={() => {
                void navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true))
              }} class="rounded-lg border border-emerald-300/30 px-4 py-2 text-[10px] font-black text-emerald-200">
                {copied ? "SKOPIOWANE" : "KOPIUJ"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <StaffLatarnikNetworkManager
        data={overview?.beaconNetwork ?? EMPTY_NETWORK}
        disabled={busy || loading}
        onRefresh={refresh}
      />

      <StaffLatarnikReleaseManager
        data={overview?.beaconReleases ?? EMPTY_RELEASES}
        skus={inventoryItems.map(item => ({
          sku: item.sku,
          label: `${item.product_name} — ${item.variant_label}`,
          available: item.available_quantity,
        }))}
        disabled={busy || loading}
        onRefresh={refresh}
      />
    </div>
  )
}

function Message({ children }: { children: ComponentChildren }) {
  return <p class="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" role="status">{children}</p>
}
