import type { ComponentChildren } from "preact"
import { useMemo, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import { qrDataUrl } from "../../../lib/qr"

type DiscoveryRun = {
  id: string
  countryCode: string
  targetCount: number
  status: string
  discoveredCount: number
  reportFilename?: string | null
  requestedAt: string
  completedAt?: string | null
  failureKind?: string | null
}

type NetworkCandidate = {
  id: string
  displayName: string
  beaconKind: string
  contactEmail?: string | null
  destinationUrl?: string | null
  sourceUrl?: string | null
  verified: boolean
  acceptsOutreach: boolean
  doNotContact: boolean
  metadata: Record<string, unknown>
}

type InviteJob = {
  id: string
  status: string
  beaconCount: number
  ttlDays: number
  radiusKm: number
  locale: string
  claimedBy?: string | null
  claimedAt?: string | null
  reportedAt?: string | null
  providerSummary: Record<string, unknown>
  exchangedCount: number
  webCount: number
  androidCount: number
  iosCount: number
  activeCount: number
  pushEnabledCount: number
  helpingCount: number
  coverageCount: number
  createdAt: string
}

type InvitePreview = {
  beaconCount: number
  ttlDays: number
  radiusKm: number
  locale: string
  byKind: Record<string, number>
  delivery: { subject: string; text: string }
  tokensMinted: false
}

type SingleInvite = {
  displayName: string
  inviteUrl: string
  expiresAt: string
}

type InviteQr = SingleInvite & { qr: string }

export type BeaconNetworkOverview = {
  discoveryRuns: DiscoveryRun[]
  pendingCandidates: NetworkCandidate[]
  approvedCandidates: NetworkCandidate[]
  inviteJobs: InviteJob[]
}

type ReviewState = {
  sourceVerified: boolean
  consentConfirmed: boolean
  evidenceUrl: string
}

type Props = {
  data: BeaconNetworkOverview
  disabled: boolean
  onRefresh: () => Promise<void>
}

const EMPTY_REVIEW: ReviewState = {
  sourceVerified: false,
  consentConfirmed: false,
  evidenceUrl: "",
}

const REQUEST_TIMEOUT_MS = 15_000
const isHttpsUrl = (value: string) => {
  try { return new URL(value).protocol === "https:" } catch { return false }
}
const displayDate = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "—"
}
const statusClass = (status: string) => {
  if (["ready", "completed"].includes(status)) return "text-emerald-300 border-emerald-400/25 bg-emerald-400/10"
  if (["failed", "ambiguous"].includes(status)) return "text-red-300 border-red-400/25 bg-red-400/10"
  if (["running", "requested", "claimed", "queued"].includes(status)) return "text-amber-200 border-amber-400/25 bg-amber-400/10"
  return "text-zinc-300 border-white/10 bg-white/[0.04]"
}
const kindLabel = (kind: string) => ({
  radio: "radio",
  local_press: "lokalne media",
  television: "telewizja",
  reviewer: "recenzent",
  creator: "twórca",
  photographer: "fotograf",
  promoter: "promotor",
  patron: "patron",
  community: "społeczność",
})[kind] ?? kind

export default function StaffLatarnikNetworkManager({ data, disabled, onRefresh }: Props) {
  const [targetCount, setTargetCount] = useState(100)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [ttlDays, setTtlDays] = useState(14)
  const [radiusKm, setRadiusKm] = useState(100)
  const [locale, setLocale] = useState<"pl" | "en">("pl")
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewKey, setPreviewKey] = useState("")
  const [inviteQr, setInviteQr] = useState<InviteQr | null>(null)
  const [copied, setCopied] = useState(false)

  const approvedIds = useMemo(() => new Set((data.approvedCandidates ?? []).map(candidate => candidate.id)), [data.approvedCandidates])
  const selectedApproved = useMemo(() => [...selected].filter(id => approvedIds.has(id)), [selected, approvedIds])
  const latestRun = data.discoveryRuns?.[0]

  const post = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    setMessage("Wykonuję…")
    try {
      await staffApi("/api/staff/commerce/campaigns", {
        method: "POST",
        timeoutMs: REQUEST_TIMEOUT_MS,
        body: { kind: "beacon_network", ...body },
      })
      setMessage(success)
      await onRefresh()
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0
      if (status === 503) {
        setMessage("Executor n8n dla tej operacji nie jest jeszcze aktywny/atestowany. Nic nie zostało wysłane ani obiecane.")
      } else {
        setMessage(error instanceof Error && error.message ? `Nie udało się: ${error.message}` : "Nie udało się wykonać operacji.")
      }
    } finally {
      setBusy(false)
    }
  }

  const discover = () => {
    const target = Math.max(1, Math.min(500, Math.trunc(targetCount || 0)))
    void post(
      { action: "discover", countryCode: "PL", targetCount: target },
      "Research Latarników PL zakolejkowany. Po zakończeniu XLSX pojawi się w statusie runa i trafi do review.",
    )
  }

  const reviewFor = (id: string) => reviews[id] ?? EMPTY_REVIEW
  const patchReview = (id: string, patch: Partial<ReviewState>) => {
    setReviews(current => ({ ...current, [id]: { ...(current[id] ?? EMPTY_REVIEW), ...patch } }))
  }

  const approve = async (candidate: NetworkCandidate) => {
    const review = reviewFor(candidate.id)
    if (!review.sourceVerified || !review.consentConfirmed || !isHttpsUrl(review.evidenceUrl)) return
    await post({
      action: "approve",
      beaconId: candidate.id,
      sourceVerified: true,
      marketingEmailConsentConfirmed: true,
      consentEvidenceUrl: review.evidenceUrl.trim(),
    }, `${candidate.displayName}: zatwierdzony do zaproszenia.`)
    setReviews(current => {
      const next = { ...current }
      delete next[candidate.id]
      return next
    })
  }

  const toggleSelected = (id: string) => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleAll = () => { setPreview(null); setPreviewKey(""); setSelected(current => {
    const all = data.approvedCandidates ?? []
    const allSelected = all.length > 0 && all.every(candidate => current.has(candidate.id))
    return allSelected ? new Set() : new Set(all.map(candidate => candidate.id))
  }) }

  const clamp = (value: number, low: number, high: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(low, Math.min(high, Math.trunc(value))) : fallback

  const boundedInvite = () => ({
    ttlDays: clamp(ttlDays, 1, 30, 14),
    radiusKm: clamp(radiusKm, 10, 500, 100),
    locale,
  })

  const inviteConfig = () => ({ beaconIds: [...selectedApproved].sort(), ...boundedInvite() })

  const previewInvites = async () => {
    if (selectedApproved.length === 0) return
    setBusy(true)
    setMessage("Sprawdzam falę bez tworzenia linków…")
    try {
      const value = await staffApi<InvitePreview>("/api/staff/commerce/campaigns", {
        method: "POST", timeoutMs: REQUEST_TIMEOUT_MS,
        body: { kind: "beacon_network", action: "preview_invites", ...inviteConfig() },
      })
      if (value.tokensMinted !== false) throw new Error("Preview unexpectedly minted invite capabilities")
      setPreview(value)
      setPreviewKey(JSON.stringify(inviteConfig()))
      setMessage(`Preview gotowy: ${value.beaconCount} kontaktów, zero utworzonych tokenów.`)
    } catch (error) {
      setPreview(null); setPreviewKey("")
      setMessage(error instanceof Error ? `Nie udało się przygotować preview: ${error.message}` : "Nie udało się przygotować preview.")
    } finally { setBusy(false) }
  }

  const queueInvites = () => {
    if (selectedApproved.length === 0) return
    if (!preview || preview.beaconCount !== selectedApproved.length || previewKey !== JSON.stringify(inviteConfig())) { setMessage("Najpierw zrób aktualny PREVIEW tej dokładnej fali."); return }
    if (!window.confirm(`Zakolejkować wysyłkę do ${selectedApproved.length} zatwierdzonych kontaktów? Tokeny powstaną dopiero przy jednorazowym claimie executora.`)) return
    if (selectedApproved.length > 50 && !window.confirm(`To duża fala (${selectedApproved.length}). Potwierdź drugi raz, że chcesz ją uruchomić teraz.`)) return
    void post({ action: "queue_invites", ...inviteConfig() }, `Zakolejkowano invite job dla ${selectedApproved.length} Latarników.`).then(() => {
      setSelected(new Set()); setPreview(null); setPreviewKey("")
    })
  }

  const showSingleQr = async (candidate: NetworkCandidate) => {
    if (!window.confirm(`Utworzyć jednorazowe zaproszenie dla ${candidate.displayName} i pokazać QR? Poprzednie żywe sesje tej relacji zostaną unieważnione.`)) return
    setBusy(true); setCopied(false); setMessage("Tworzę jednorazowy QR…")
    try {
      const value = await staffApi<SingleInvite>("/api/staff/commerce/campaigns", {
        method: "POST", timeoutMs: REQUEST_TIMEOUT_MS,
        body: { kind: "beacon_network", action: "single_invite", beaconId: candidate.id, ...boundedInvite() },
      })
      if (!value.inviteUrl.startsWith("https://virya.music/")) throw new Error("Unexpected invite URL")
      setInviteQr({ ...value, qr: qrDataUrl(value.inviteUrl, 7, 4) })
      setMessage("QR utworzony. Link istnieje tylko w tym otwartym oknie.")
      await onRefresh()
    } catch (error) {
      setMessage(error instanceof Error ? `Nie udało się utworzyć QR: ${error.message}` : "Nie udało się utworzyć QR.")
    } finally { setBusy(false) }
  }

  const closeInviteQr = () => { setInviteQr(null); setCopied(false) }
  const copyInviteLink = async () => {
    if (!inviteQr) return
    try { await navigator.clipboard.writeText(inviteQr.inviteUrl); setCopied(true) }
    catch { setMessage("Nie udało się skopiować linku — zeskanuj QR.") }
  }

  return (
    <section class="rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.05] to-zinc-950 p-5 sm:p-7">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Latarnik / network</p>
          <h2 class="mt-2 text-2xl font-black text-white sm:text-3xl">Research → review → zaproszenie</h2>
          <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Research może znaleźć publiczne kontakty i przygotować XLSX. <strong class="text-zinc-200">Publiczny e-mail nie jest zgodą na marketing.</strong> Zaproszenie staje się możliwe dopiero po ręcznym potwierdzeniu źródła i dowodu zgody.
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="DO REVIEW" value={data.pendingCandidates?.length ?? 0} />
          <Metric label="GOTOWI" value={data.approvedCandidates?.length ?? 0} />
          <Metric label="JOBY" value={data.inviteJobs?.length ?? 0} />
        </div>
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-[180px_auto] sm:items-end">
        <label class="grid gap-2 text-sm font-semibold text-zinc-200">
          Cel researchu PL
          <input type="number" min="1" max="500" step="1" value={targetCount} onInput={event => setTargetCount(Number(event.currentTarget.value))} class="input" />
        </label>
        <button type="button" disabled={disabled || busy} onClick={discover} class="min-h-11 rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black text-zinc-950 disabled:opacity-40">
          SZUKAJ LATARNIKÓW PL
        </button>
      </div>

      {latestRun ? (
        <div class="mt-4 rounded-lg border border-white/10 bg-black/30 p-4 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <strong class="text-zinc-100">Ostatni research: {latestRun.countryCode} · cel {latestRun.targetCount}</strong>
            <span class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(latestRun.status)}`}>{latestRun.status}</span>
          </div>
          <p class="mt-2 text-xs text-zinc-500">znaleziono {latestRun.discoveredCount} · start {displayDate(latestRun.requestedAt)} · koniec {displayDate(latestRun.completedAt)}</p>
          {latestRun.reportFilename ? <p class="mt-1 text-xs text-cyan-200">XLSX: {latestRun.reportFilename}</p> : null}
          {latestRun.failureKind ? <p class="mt-1 text-xs text-red-300">Błąd: {latestRun.failureKind}</p> : null}
        </div>
      ) : null}
      {message ? <p class="mt-4 rounded-xl border border-cyan-300/20 bg-black/30 px-4 py-3 text-sm text-cyan-100" role="status">{message}</p> : null}

      <div class="mt-8">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Review</p>
            <h3 class="mt-1 text-xl font-black text-white">Kandydaci znalezieni publicznie</h3>
          </div>
          <span class="text-xs text-zinc-500">{data.pendingCandidates?.length ?? 0}</span>
        </div>
        <div class="mt-4 grid gap-3">
          {(data.pendingCandidates ?? []).length === 0 ? <Empty>Brak kandydatów oczekujących na review.</Empty> : data.pendingCandidates.map(candidate => {
            const review = reviewFor(candidate.id)
            const canApprove = review.sourceVerified && review.consentConfirmed && isHttpsUrl(review.evidenceUrl)
            return (
              <article key={candidate.id} class="rounded-lg border border-white/10 bg-black/30 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong class="text-sm text-white">{candidate.displayName}</strong>
                    <span class="ml-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">{kindLabel(candidate.beaconKind)}</span>
                    <p class="mt-1 text-xs text-zinc-400">{candidate.contactEmail || candidate.destinationUrl || "brak bezpośredniego kontaktu"}</p>
                    {candidate.sourceUrl ? <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" class="mt-1 inline-block break-all text-xs text-cyan-300 underline decoration-cyan-300/30">źródło publiczne ↗</a> : null}
                  </div>
                </div>
                <div class="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <label class="grid gap-2 text-xs font-bold text-zinc-300">
                    HTTPS URL dowodu zgody marketingowej
                    <input value={review.evidenceUrl} onInput={event => patchReview(candidate.id, { evidenceUrl: event.currentTarget.value })} placeholder="https://…" class="input" />
                  </label>
                  <button type="button" disabled={disabled || busy || !canApprove} onClick={() => void approve(candidate)} class="min-h-11 rounded-xl bg-white px-4 py-3 text-xs font-black text-zinc-950 disabled:opacity-35">ZATWIERDŹ DO ZAPROSZENIA</button>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  <label class="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={review.sourceVerified} onChange={event => patchReview(candidate.id, { sourceVerified: event.currentTarget.checked })} />
                    Źródło i tożsamość są zweryfikowane
                  </label>
                  <label class="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={review.consentConfirmed} onChange={event => patchReview(candidate.id, { consentConfirmed: event.currentTarget.checked })} />
                    Mam dowód zgody na marketing e-mail
                  </label>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div class="mt-8">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Zaproszenia</p>
            <h3 class="mt-1 text-xl font-black text-white">Zatwierdzeni kandydaci</h3>
          </div>
          <button type="button" disabled={disabled || busy || (data.approvedCandidates ?? []).length === 0} onClick={toggleAll} class="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black text-zinc-300 disabled:opacity-40">ZAZNACZ / WYCZYŚĆ</button>
        </div>
        <div class="mt-4 grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4 sm:grid-cols-4 sm:items-end">
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">TTL dni
            <input class="input" type="number" min="1" max="30" value={ttlDays} onInput={event => { setTtlDays(Number(event.currentTarget.value)); setPreview(null); setPreviewKey("") }} />
          </label>
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">Promień km
            <input class="input" type="number" min="10" max="500" value={radiusKm} onInput={event => { setRadiusKm(Number(event.currentTarget.value)); setPreview(null); setPreviewKey("") }} />
          </label>
          <label class="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">Język
            <select class="input" value={locale} onChange={event => { setLocale(event.currentTarget.value === "en" ? "en" : "pl"); setPreview(null); setPreviewKey("") }}><option value="pl">PL</option><option value="en">EN</option></select>
          </label>
          <div class="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy || selectedApproved.length === 0} onClick={() => void previewInvites()} class="rounded-lg border border-cyan-300/40 px-4 py-2 text-[10px] font-black text-cyan-200 disabled:opacity-40">PREVIEW ({selectedApproved.length})</button>
            <button type="button" disabled={disabled || busy || selectedApproved.length === 0 || !preview} onClick={queueInvites} class="rounded-lg bg-cyan-300 px-4 py-2 text-[10px] font-black text-zinc-950 disabled:opacity-40">WYŚLIJ FALĘ</button>
          </div>
        </div>
        {preview ? <div class="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] p-4 text-xs text-zinc-300">
          <div class="flex flex-wrap justify-between gap-2"><strong class="text-cyan-100">PREVIEW · {preview.beaconCount} kontaktów · tokeny: 0</strong><span>TTL {preview.ttlDays} dni · {preview.radiusKm} km · {preview.locale.toUpperCase()}</span></div>
          <p class="mt-2 text-zinc-500">{Object.entries(preview.byKind).map(([kind, count]) => `${kindLabel(kind)}: ${count}`).join(" · ")}</p>
          <details class="mt-3"><summary class="cursor-pointer font-black text-zinc-300">Pokaż mail</summary><strong class="mt-3 block text-white">{preview.delivery.subject}</strong><pre class="mt-2 whitespace-pre-wrap font-sans leading-5 text-zinc-400">{preview.delivery.text}</pre></details>
        </div> : null}
        <div class="mt-4 grid gap-2">
          {(data.approvedCandidates ?? []).length === 0 ? <Empty>Brak zatwierdzonych kandydatów bez aktywnego konta Latarnika.</Empty> : data.approvedCandidates.map(candidate => (
            <article key={candidate.id} class="flex min-h-12 flex-wrap items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-3">
              <label class="flex min-w-0 flex-1 items-center gap-3">
                <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => { toggleSelected(candidate.id); setPreview(null); setPreviewKey("") }} />
                <span class="min-w-0 flex-1">
                  <strong class="block truncate text-sm text-zinc-100">{candidate.displayName}</strong>
                  <span class="block truncate text-xs text-zinc-500">{candidate.contactEmail} · {kindLabel(candidate.beaconKind)}</span>
                </span>
              </label>
              <span class="text-[9px] font-black uppercase tracking-wider text-emerald-300">review OK</span>
              <button type="button" disabled={disabled || busy} onClick={() => void showSingleQr(candidate)} class="rounded-lg border border-emerald-300/30 px-3 py-2 text-[9px] font-black text-emerald-200 disabled:opacity-40">POKAŻ QR</button>
            </article>
          ))}
        </div>
      </div>

      {(data.inviteJobs ?? []).length ? (
        <div class="mt-8">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Ostatnie invite joby</p>
          <div class="mt-3 grid gap-2">
            {data.inviteJobs.slice(0, 8).map(job => (
              <div key={job.id} class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs">
                <span class="text-zinc-300"><strong>{job.beaconCount}</strong> kontaktów · aktywni {job.activeCount ?? 0} · web {job.webCount ?? 0} / Android {job.androidCount ?? 0} · push {job.pushEnabledCount ?? 0} · pomoc {job.helpingCount ?? 0} · coverage {job.coverageCount ?? 0}</span>
                <span class={`rounded-full border px-3 py-1 text-[9px] font-black uppercase ${statusClass(job.status)}`}>{job.status}</span>
                <span class="text-zinc-600">{displayDate(job.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {inviteQr ? <div class="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Jednorazowe zaproszenie Latarnika">
        <div class="w-full max-w-md rounded-xl border border-cyan-300/25 bg-zinc-950 p-6 shadow-2xl">
          <p class="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Zaproszenie do Latarnika</p>
          <h3 class="mt-2 text-xl font-black text-white">{inviteQr.displayName}</h3>
          <div class="mx-auto mt-5 max-w-[280px] rounded-lg bg-white p-4"><img src={inviteQr.qr} alt="Jednorazowy QR zaproszenia do Latarnika" class="h-auto w-full" /></div>
          <p class="mt-4 text-center text-xs text-zinc-500">Ważne do {displayDate(inviteQr.expiresAt)}. QR i link nie są zapisywane przez panel.</p>
          <div class="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyInviteLink()} class="min-h-11 rounded-xl border border-white/15 px-4 text-xs font-black text-zinc-200">{copied ? "SKOPIOWANO" : "KOPIUJ LINK"}</button>
            <button type="button" onClick={closeInviteQr} class="min-h-11 rounded-xl bg-cyan-300 px-4 text-xs font-black text-zinc-950">ZAMKNIJ I WYCZYŚĆ</button>
          </div>
        </div>
      </div> : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div class="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2">
    <strong class="block text-lg text-white">{value}</strong>
    <span class="text-[9px] font-black tracking-wider text-zinc-500">{label}</span>
  </div>
}

function Empty({ children }: { children: ComponentChildren }) {
  return <p class="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">{children}</p>
}
