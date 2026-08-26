import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"
import {
  generateQr,
  renderQrToCanvas,
  type GeneratedQr,
} from "../../../lib/qrCode"
import type {
  StaffQrCampaign,
  StaffQrEvent,
  StaffQrOverview,
} from "../../../server/staffQrApi"
import { bootstrapStaffPanel, staffApi, type StaffApiError } from "./staffApi"
import { ConfirmButton, Notice, StaffLoginCard, StaffStatusCard, type NoticeState } from "./AdminConsoleUi"
import { staffLogoutButton, staffSecondaryButton } from "./staffButtons"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type Language = "pl" | "en"

type ApiError = StaffApiError

type ApiOptions = {
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
}

const REQUEST_TIMEOUT_MS = 10_000
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

const api = <T,>(path: string, options: ApiOptions = {}) =>
  staffApi<T>(path, { ...options, timeoutMs: REQUEST_TIMEOUT_MS })

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError"

export default function ConcertQrManager() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [events, setEvents] = useState<StaffQrEvent[]>([])
  const [campaigns, setCampaigns] = useState<StaffQrCampaign[]>([])
  const [selectedEvent, setSelectedEvent] = useState("")
  const [label, setLabel] = useState("")
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [maxCheckins, setMaxCheckins] = useState("")
  const [language, setLanguage] = useState<Language>("pl")
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [message, setMessage] = useState<NoticeState>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const fullscreenCloseRef = useRef<HTMLButtonElement | null>(null)
  const dataRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // One invocation: the overview carries the session verdict with it.
    void bootstrapStaffPanel<StaffQrOverview>("/api/staff/qr/overview", {
      signal: controller.signal,
    }).then(result => {
      if (controller.signal.aborted) return
      if (result.state === "ready" && result.data) {
        setState("ready")
        applyOverview(result.data)
        return
      }
      setState(result.state === "ready" ? "error" : result.state)
      if (result.state === "login") {
        queueMicrotask(() => passwordRef.current?.focus())
      }
    })

    return () => {
      controller.abort()
      dataRequestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false)
        return
      }
      if (event.key === "Tab") {
        event.preventDefault()
        fullscreenCloseRef.current?.focus()
      }
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleDialogKey)
    queueMicrotask(() => fullscreenCloseRef.current?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleDialogKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [fullscreen])

  const activeCampaign = useMemo(
    () =>
      campaigns.find(campaign => campaign.id === selectedCampaignId) ??
      campaigns.find(campaign => campaign.active && !!campaign.token) ??
      null,
    [campaigns, selectedCampaignId],
  )

  const checkinUrl = useMemo(() => {
    if (!activeCampaign?.token) return null
    const prefix = language === "pl" ? "/pl" : ""
    return `https://virya.music${prefix}/live/${encodeURIComponent(activeCampaign.event_slug)}/#checkin=${activeCampaign.token}`
  }, [activeCampaign, language])

  const qr = useMemo<GeneratedQr | null>(() => {
    if (!checkinUrl) return null
    try {
      return generateQr(checkinUrl)
    } catch {
      return null
    }
  }, [checkinUrl])

  async function refreshData() {
    if (busy) return
    setBusy(true)
    try {
      await loadData()
    } finally {
      setBusy(false)
    }
  }

  function applyOverview(overview: StaffQrOverview) {
    const upcoming = [...overview.events]
      .filter(event => Date.parse(event.starts_at) > Date.now() - 36 * 60 * 60 * 1000)
      .sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at))
    setEvents(upcoming)
    setCampaigns(overview.campaigns)
    setSelectedCampaignId(current =>
      overview.campaigns.some(campaign => campaign.id === current)
        ? current
        : overview.campaigns.find(campaign => campaign.active && campaign.token)?.id ?? null,
    )
    const nextEvent = upcoming.find(event => event.slug === selectedEvent) ?? upcoming[0]
    if (nextEvent && nextEvent.slug !== selectedEvent) selectEvent(nextEvent)
    if (!nextEvent) {
      setSelectedEvent("")
      setLabel("")
      setValidFrom("")
      setValidUntil("")
    }
    setDataLoaded(true)
  }

  async function loadData() {
    dataRequestRef.current?.abort()
    const controller = new AbortController()
    dataRequestRef.current = controller
    setDataLoading(true)
    setMessage(null)

    try {
      const overview = await api<StaffQrOverview>("/api/staff/qr/overview", {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      applyOverview(overview)
    } catch (error) {
      if (isAbortError(error)) return
      if ((error as ApiError).status === 401) {
        setState("login")
      } else {
        setMessage({ tone: "error", text: "Nie udało się pobrać katalogu wydarzeń i kampanii." })
      }
      setDataLoaded(true)
    } finally {
      if (dataRequestRef.current === controller) {
        dataRequestRef.current = null
        setDataLoading(false)
      }
    }
  }

  function selectEvent(event: StaffQrEvent) {
    setSelectedEvent(event.slug)
    setLabel(`Koncert — ${event.title}`)
    const starts = new Date(event.starts_at)
    setValidFrom(toLocalInput(new Date(starts.getTime() - 60 * 60 * 1000)))
    setValidUntil(toLocalInput(new Date(starts.getTime() + 5 * 60 * 60 * 1000)))
  }

  async function login(event: Event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      await api("/api/staff/qr/login", {
        method: "POST",
        body: { password },
      })
      setPassword("")
      setState("ready")
      await loadData()
    } catch (error) {
      setMessage({
        tone: "error",
        text: (error as ApiError).status === 429
          ? "Za dużo prób. Spróbuj ponownie za kilkanaście minut."
          : "Nieprawidłowe hasło.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (busy) return
    setBusy(true)
    try {
      await api("/api/staff/qr/logout", { method: "POST" })
    } finally {
      setCampaigns([])
      setEvents([])
      setSelectedCampaignId(null)
      setDataLoaded(false)
      setState("login")
      setBusy(false)
    }
  }

  async function createCampaign(event: Event) {
    event.preventDefault()
    if (busy || !selectedEvent || !label || !validFrom || !validUntil) return
    setBusy(true)
    setMessage(null)
    try {
      const campaign = await api<StaffQrCampaign>("/api/staff/qr/campaigns", {
        method: "POST",
        body: {
          event_slug: selectedEvent,
          label: label.trim(),
          valid_from: new Date(validFrom).toISOString(),
          valid_until: new Date(validUntil).toISOString(),
          max_checkins: maxCheckins ? Number(maxCheckins) : null,
        },
      })
      setCampaigns(current => [campaign, ...current])
      setSelectedCampaignId(campaign.id)
      setMessage({ tone: "success", text: "Kampania QR została utworzona." })
    } catch (error) {
      const status = (error as ApiError).status
      setMessage({
        tone: "error",
        text: status === 422
          ? "Sprawdź termin. QR może działać od 24 h przed do 36 h po rozpoczęciu koncertu."
          : "Nie udało się utworzyć kampanii QR.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function revoke(campaign: StaffQrCampaign) {
    if (busy || !campaign.active) return
    setBusy(true)
    setMessage(null)
    try {
      await api(`/api/staff/qr/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: "POST",
      })
      await loadData()
      setMessage({ tone: "success", text: "Kampania została wyłączona." })
    } catch {
      setMessage({ tone: "error", text: "Nie udało się wyłączyć kampanii." })
    } finally {
      setBusy(false)
    }
  }

  function downloadSvg() {
    if (!qr || !activeCampaign) return
    downloadBlob(
      new Blob([qr.svg], { type: "image/svg+xml;charset=utf-8" }),
      fileName(activeCampaign, "svg"),
    )
  }

  function downloadPng() {
    if (!qr || !activeCampaign) return
    const canvas = document.createElement("canvas")
    renderQrToCanvas(canvas, qr.matrix)
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, fileName(activeCampaign, "png"))
    }, "image/png")
  }

  async function copyLink() {
    if (!checkinUrl) return
    try {
      await navigator.clipboard.writeText(checkinUrl)
      setMessage({ tone: "success", text: "Link QR skopiowany." })
    } catch {
      setMessage({ tone: "error", text: "Nie udało się skopiować linku." })
    }
  }

  function printCampaign() {
    if (!qr || !activeCampaign) return
    const popup = window.open("", "_blank")
    if (!popup) {
      setMessage({ tone: "error", text: "Przeglądarka zablokowała okno wydruku." })
      return
    }
    popup.opener = null

    const venue = activeCampaign.venue ??
      (language === "pl" ? "Miejsce koncertu" : "Concert venue")
    const printCopy =
      language === "pl"
        ? {
            brand: "VIRYA // SYGNAŁ LIVE",
            instruction: "Zeskanuj. Potwierdź obecność. Zwiększ szansę na album.",
            note: "Jedno potwierdzenie na osobę i koncert. Kod działa wyłącznie w określonym czasie. Do udziału potrzebny jest aktywny Sygnał Virya.",
            valid: "Aktywny",
          }
        : {
            brand: "VIRYA // SIGNAL LIVE",
            instruction: "Scan. Confirm attendance. Increase your album chance.",
            note: "One confirmation per person and show. The code works only during the stated window. An active Virya Signal is required.",
            valid: "Active",
          }
    const printLocale = language === "pl" ? "pl-PL" : "en-GB"

    popup.document.open()
    popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QR — ${escapeHtml(activeCampaign.event_title)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#09090b}.sheet{min-height:260mm;border:3px solid #09090b;padding:18mm;display:flex;flex-direction:column;align-items:center;text-align:center}.brand{font-size:12px;font-weight:900;letter-spacing:.28em}.title{margin:14mm 0 2mm;font-size:34px;line-height:.95;text-transform:uppercase}.venue{font-size:17px;font-weight:700}.qr{width:145mm;max-width:100%;margin:12mm auto 8mm}.qr svg{display:block;width:100%;height:auto}.instruction{font-size:22px;font-weight:900;text-transform:uppercase}.note{max-width:140mm;margin-top:4mm;font-size:13px;line-height:1.5}.valid{margin-top:auto;font-size:11px}</style></head><body><main class="sheet"><div class="brand">${escapeHtml(printCopy.brand)}</div><h1 class="title">${escapeHtml(activeCampaign.event_title)}</h1><div class="venue">${escapeHtml(venue)}</div><div class="qr">${qr.svg}</div><div class="instruction">${escapeHtml(printCopy.instruction)}</div><p class="note">${escapeHtml(printCopy.note)}</p><div class="valid">${escapeHtml(printCopy.valid)}: ${escapeHtml(formatDate(activeCampaign.valid_from, printLocale))} — ${escapeHtml(formatDate(activeCampaign.valid_until, printLocale))}</div></main></body></html>`)
    popup.document.close()
    window.setTimeout(() => {
      popup.focus()
      popup.print()
    }, 250)
  }

  if (state === "checking") {
    return <StaffStatusCard title="Sprawdzam dostęp…" loading />
  }

  if (state === "unconfigured") {
    return (
      <StaffStatusCard
        title="Panel nie jest skonfigurowany"
        body="Panel nie ma jeszcze włączonego dostępu. Poproś osobę prowadzącą techniczną stronę o jego konfigurację."
      />
    )
  }

  if (state === "error") {
    return <StaffStatusCard title="Panel chwilowo niedostępny" body="Odśwież stronę za chwilę. Jeśli problem nie zniknie, napisz do osoby prowadzącej techniczną stronę." />
  }

  if (state === "login") {
    return (
      <div class="py-6">
        <StaffLoginCard
          eyebrow="VIRYA // STAFF"
          title="Generator QR"
          description="Dostęp tylko dla zespołu. Hasło nie jest zapisywane w przeglądarce."
          passwordRef={passwordRef}
          password={password}
          onPasswordInput={setPassword}
          busy={busy}
          message={message ?? undefined}
          onSubmit={login}
          submitLabel="Otwórz panel"
          busyLabel="Logowanie…"
        />
      </div>
    )
  }

  return (
    <div class="relative grid w-full min-w-0 max-w-full gap-6">
      {dataLoading && <BackendLoader overlay label="Pobieram koncerty, kampanie QR i bramkę…" />}
      <header class="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">
            VIRYA // STAFF
          </p>
          <h1 class="mt-3 text-3xl font-black uppercase leading-none text-white sm:text-4xl">
            Koncertowe QR
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Twórz krótkotrwałe, odwoływalne kody przypisane do konkretnego koncertu. Token trafia wyłącznie do fragmentu URL i nie jest wysyłany w referrerze.
          </p>
        </div>
        <div class="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-none">
          <button type="button" onClick={() => void refreshData()} disabled={busy || dataLoading} class={secondaryButton}>
            Odśwież
          </button>
          <button type="button" onClick={() => void logout()} disabled={busy} class={staffLogoutButton}>
            Wyloguj
          </button>
        </div>
      </header>

      {message && (
        <div>
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      <section class="grid gap-3 sm:grid-cols-3" aria-label="Stan panelu QR">
        <Metric label="Nadchodzące koncerty" value={String(events.length)} />
        <Metric label="Aktywne kampanie" value={String(campaigns.filter(campaign => campaign.active).length)} />
        <Metric label="Łączne check-iny" value={String(campaigns.reduce((sum, campaign) => sum + campaign.checkin_count, 0))} />
      </section>

      <div class="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={createCampaign} class={panelClass}>
          <p class={eyebrowClass}>Nowa kampania</p>
          <h2 class="mt-2 text-xl font-black uppercase text-white">Wybierz koncert i czas</h2>

          <label class={labelClass}>
            Koncert
            <select
              value={selectedEvent}
              onChange={event => {
                const selected = events.find(item => item.slug === event.currentTarget.value)
                if (selected) selectEvent(selected)
              }}
              required
              class={inputClass}
            >
              <option value="">
                {dataLoaded && events.length === 0
                  ? "Brak opublikowanych wydarzeń"
                  : "Wybierz wydarzenie"}
              </option>
              {events.map(event => (
                <option value={event.slug} key={event.id}>
                  {formatDate(event.starts_at)} — {event.title}
                </option>
              ))}
            </select>
          </label>

          <label class={labelClass}>
            Etykieta wewnętrzna
            <input value={label} onInput={event => setLabel(event.currentTarget.value)} maxlength={160} required class={inputClass} />
          </label>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <label class="min-w-0 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              Aktywny od
              <input type="datetime-local" value={validFrom} onInput={event => setValidFrom(event.currentTarget.value)} required class={inputClass} />
            </label>
            <label class="min-w-0 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              Aktywny do
              <input type="datetime-local" value={validUntil} onInput={event => setValidUntil(event.currentTarget.value)} required class={inputClass} />
            </label>
          </div>

          <label class={labelClass}>
            Limit check-inów (opcjonalnie)
            <input type="number" min="1" max="1000000" inputmode="numeric" value={maxCheckins} onInput={event => setMaxCheckins(event.currentTarget.value)} placeholder="Bez limitu" class={inputClass} />
          </label>

          {dataLoaded && events.length === 0 && (
            <div class="mt-5 border border-amber-400/25 bg-amber-400/[.045] p-4 text-xs leading-relaxed text-zinc-300">
              CrowdRelay nie zwrócił żadnego opublikowanego koncertu. Uruchom ponownie produkcyjny setup po wdrożeniu aktualnego bootstrapu.
            </div>
          )}

          <button type="submit" disabled={busy || !selectedEvent} class="virya-button virya-button--primary mt-6 min-h-[48px] w-full px-5">
            {busy ? "Zapisywanie…" : "Utwórz bezpieczny QR"}
          </button>
        </form>

        <section class={panelClass}>
          <div class="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <p class={eyebrowClass}>Podgląd / druk</p>
              <h2 class="mt-2 text-xl font-black uppercase text-white">
                {activeCampaign?.event_title ?? "Wybierz kampanię"}
              </h2>
            </div>
            <select
              value={selectedCampaignId ?? ""}
              onChange={event => setSelectedCampaignId(event.currentTarget.value || null)}
              class="virya-input min-h-[44px] w-full min-w-0 max-w-full text-xs sm:w-auto sm:max-w-[22rem]"
            >
              <option value="">
                {dataLoaded && campaigns.length === 0
                  ? "Brak kampanii"
                  : "Wybierz kampanię"}
              </option>
              {campaigns.map(campaign => (
                <option value={campaign.id} key={campaign.id}>
                  {campaign.active ? "●" : "○"} {campaign.label}
                </option>
              ))}
            </select>
          </div>

          {activeCampaign && qr && checkinUrl ? (
            <div class="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] lg:items-start">
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                class="block w-full min-w-0 max-w-full overflow-hidden border border-zinc-700 bg-white p-4 hover:border-amber-400 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full"
                aria-label="Otwórz QR na pełnym ekranie"
                dangerouslySetInnerHTML={{ __html: qr.svg }}
              />
              <div class="min-w-0">
                <dl class="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-1">
                  <Info label="Stan" value={activeCampaign.active ? "Aktywny" : "Wyłączony"} />
                  <Info label="Check-iny" value={`${activeCampaign.checkin_count}${activeCampaign.max_checkins ? ` / ${activeCampaign.max_checkins}` : ""}`} />
                  <Info label="Od" value={formatDate(activeCampaign.valid_from)} />
                  <Info label="Do" value={formatDate(activeCampaign.valid_until)} />
                </dl>
                <label class="mt-5 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                  Język strony po skanie
                  <select value={language} onChange={event => setLanguage(event.currentTarget.value as Language)} class={inputClass}>
                    <option value="pl">Polski</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <div class="mt-5 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={printCampaign} class={primaryButton}>Drukuj A4</button>
                  <button type="button" onClick={downloadSvg} class={secondaryButton}>Pobierz SVG</button>
                  <button type="button" onClick={downloadPng} class={secondaryButton}>Pobierz PNG</button>
                  <button type="button" onClick={() => void copyLink()} class={secondaryButton}>Kopiuj link</button>
                  {activeCampaign.active && (
                    <div class="sm:col-span-2">
                      <ConfirmButton
                        busy={busy}
                        busyLabel="WYŁĄCZAM…"
                        confirmLabel="TAK, WYŁĄCZ — WYDRUK PRZESTANIE DZIAŁAĆ"
                        onConfirm={() => void revoke(activeCampaign)}
                      >
                        Wyłącz ten QR
                      </ConfirmButton>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p class="mt-6 border border-dashed border-zinc-700 p-8 text-center text-xs leading-relaxed text-zinc-500">
              Utwórz kampanię albo wybierz aktywną pozycję z listy.
            </p>
          )}
        </section>
      </div>

      <section class={panelClass}>
        <p class={eyebrowClass}>Historia</p>
        <h2 class="mt-2 text-xl font-black uppercase text-white">Kampanie koncertowe</h2>
        {campaigns.length === 0 ? (
          <p class="mt-5 text-xs text-zinc-500">Brak kampanii.</p>
        ) : (
          <>
            {/* Desktop: pełna tabela. Mobile: karty — na bramce działa się jednym
                kciukiem i poziomy scroll tabeli był nie do użycia. */}
            <div class="mt-5 hidden w-full max-w-full overflow-x-auto overscroll-x-contain lg:block">
            <table class="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead class="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                <tr class="border-b border-zinc-800">
                  <th class="p-3">Kampania</th><th class="p-3">Koncert</th><th class="p-3">Aktywność</th><th class="p-3">Check-iny</th><th class="p-3">Stan</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(campaign => (
                  <tr key={campaign.id} class="border-b border-zinc-900 hover:bg-zinc-900/40">
                    <td class="p-3 font-bold text-white"><button type="button" onClick={() => setSelectedCampaignId(campaign.id)} class="text-left hover:text-amber-400">{campaign.label}</button></td>
                    <td class="p-3 text-zinc-300">{campaign.event_title}</td>
                    <td class="p-3 text-zinc-400">{formatDate(campaign.valid_from)}<br />{formatDate(campaign.valid_until)}</td>
                    <td class="p-3 font-mono text-amber-400">{campaign.checkin_count}{campaign.max_checkins ? ` / ${campaign.max_checkins}` : ""}</td>
                    <td class="p-3"><span class={campaign.active ? "text-emerald-300" : "text-zinc-500"}>{campaign.active ? "Aktywny" : "Wyłączony"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div class="mt-5 grid gap-3 lg:hidden">
              {campaigns.map(campaign => (
                <article key={campaign.id} class={`rounded-lg border p-4 ${campaign.id === selectedCampaignId ? "border-amber-400/50 bg-amber-400/[.05]" : "border-zinc-800 bg-black/30"}`}>
                  <div class="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedCampaignId(campaign.id)} class="min-h-[44px] text-left font-bold text-white hover:text-amber-400">{campaign.label}</button>
                    <span class={`flex-none rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${campaign.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-zinc-500"}`}>{campaign.active ? "Aktywny" : "Wyłączony"}</span>
                  </div>
                  <p class="mt-1 text-sm text-zinc-300">{campaign.event_title}</p>
                  <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><dt class="text-zinc-500">Ważny od</dt><dd class="font-semibold text-zinc-200">{formatDate(campaign.valid_from)}</dd></div>
                    <div><dt class="text-zinc-500">Ważny do</dt><dd class="font-semibold text-zinc-200">{formatDate(campaign.valid_until)}</dd></div>
                    <div><dt class="text-zinc-500">Check-iny</dt><dd class="font-mono font-bold text-amber-400">{campaign.checkin_count}{campaign.max_checkins ? ` / ${campaign.max_checkins}` : ""}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {fullscreen && qr && activeCampaign && (
        <div class="fixed inset-0 z-[10000] flex flex-col bg-white p-4 text-black sm:p-8" role="dialog" aria-modal="true" aria-label="Kod QR na pełnym ekranie">
          <div class="flex min-w-0 items-center justify-between gap-4">
            <div class="min-w-0"><p class="text-xs font-black uppercase tracking-[.25em]">VIRYA // LIVE</p><h2 class="mt-1 break-words text-xl font-black uppercase">{activeCampaign.event_title}</h2></div>
            <button ref={fullscreenCloseRef} type="button" onClick={() => setFullscreen(false)} class="min-h-[44px] flex-none border border-black px-4 text-xs font-black uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">Zamknij</button>
          </div>
          <div class="mx-auto flex min-h-0 w-full max-w-[82vh] flex-1 items-center justify-center" dangerouslySetInnerHTML={{ __html: qr.svg }} />
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt class="text-[8px] font-black uppercase tracking-widest text-zinc-500">{label}</dt><dd class="mt-1 font-semibold text-zinc-200">{value}</dd></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div class="virya-panel relative overflow-hidden p-4">
      <div class="virya-live-card__rail" aria-hidden="true" />
      <p class="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">{label}</p>
      <p class="mt-2 font-mono text-2xl font-black text-white">{value}</p>
    </div>
  )
}

const panelClass = "virya-panel min-w-0 max-w-full p-5 sm:p-6"
const eyebrowClass = "text-[9px] font-black uppercase tracking-[.28em] text-amber-400"
const labelClass = "mt-5 block min-w-0 text-[9px] font-black uppercase tracking-widest text-zinc-400"
const inputClass = "virya-input mt-2 w-full min-w-0 max-w-full px-3 text-sm"
const primaryButton = "virya-button virya-button--primary min-h-[44px] min-w-0 px-4"
const secondaryButton = staffSecondaryButton

function toLocalInput(value: Date) {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function formatDate(value: string, locale = "pl-PL") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  let formatter = dateFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    })
    dateFormatters.set(locale, formatter)
  }
  return formatter.format(date)
}

function fileName(campaign: StaffQrCampaign, extension: "svg" | "png") {
  const slug = campaign.event_slug.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80)
  return `virya-qr-${slug}.${extension}`
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}
