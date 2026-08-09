import { useEffect, useMemo, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"

type FeatureFlag = {
  key: string
  enabled: boolean
  reason: string | null
  version: number
  updated_at: string
}
type ReconciliationRun = {
  id: string
  status: string
  trigger: string
  finding_count: number
  started_at: string
  finished_at: string | null
}
type Finding = {
  id: string
  kind: string
  severity: "info" | "warning" | "critical"
  entity_label: string | null
  summary: string
  suggested_action: string | null
  created_at: string
}
type EventItem = {
  id: string
  slug: string
  title: string
  venue: string | null
  starts_at: string
}
type Overview = {
  schema_version: number
  flags: FeatureFlag[]
  last_reconciliation: ReconciliationRun | null
  open_findings: number
  next_event: EventItem | null
}
type ChecklistItem = {
  item_key: string
  status: "pending" | "done" | "blocked" | "skipped"
  note: string | null
  updated_at: string
}
type Checklist = {
  event_id: string
  event_slug: string
  event_title: string
  starts_at: string
  items: ChecklistItem[]
}
type ProofBatch = {
  id: string
  proof_kind: "audit_ledger" | "draw_receipt"
  root_sha256: string
  leaf_count: number
  status: "queued" | "processing" | "confirmed" | "failed" | "dead"
  attempts: number
  max_attempts: number
  anchor_kind: string | null
  anchor_url: string | null
  anchor_entry_id: string | null
  anchor_sequence: number | null
  anchor_integrated_at: string | null
  anchor_log_id: string | null
  signer_fingerprint: string | null
  signed_payload_sha256: string | null
  last_error_kind: string | null
  created_at: string
  confirmed_at: string | null
}

const labels: Record<string, string> = {
  ticket_sales_enabled: "Sprzedaż biletów",
  ticket_delivery_enabled: "Dostarczenie biletów",
  gate_redemption_enabled: "Check-in na bramce",
  mailer_enabled: "Maile automatyczne",
  meta_publish_enabled: "Publikacja Meta",
  bandsintown_sync_enabled: "Synchronizacja Bandsintown",
  n8n_ingress_enabled: "Ingress automatyzacji",
  automatic_retry_enabled: "Ręczny retry kolejek",
  draw_proofs_enabled: "Dowody losowań",
  external_proof_anchoring_enabled: "Kotwiczenie w Sigstore Rekor",
}
const checklistLabels: Record<string, string> = {
  announcement_published: "Zapowiedź opublikowana",
  ticketing_verified: "Sprzedaż i limity sprawdzone",
  staff_assigned: "Obsada bramki przypisana",
  offline_snapshot_ready: "Snapshot offline pobrany",
  gate_device_charged: "Telefon bramkowy naładowany",
  backup_device_ready: "Urządzenie zapasowe gotowe",
  network_tested: "Sieć sprawdzona",
  guestlist_checked: "Guestlista sprawdzona",
  post_show_reconciliation: "Reconciliation po koncercie",
  post_show_report: "Raport po wydarzeniu",
}

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  headers.set("Accept", "application/json")
  if (init?.body) headers.set("Content-Type", "application/json")
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
    headers,
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return payload
}

const formatDate = (value: string | null | undefined) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Warsaw",
      }).format(new Date(value))
    : "—"

export default function EcosystemControl() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [proofs, setProofs] = useState<ProofBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")

  const nextEventSlug = overview?.next_event?.slug ?? ""
  const critical = useMemo(
    () => findings.filter(item => item.severity === "critical").length,
    [findings],
  )
  const proofStats = useMemo(() => ({
    confirmed: proofs.filter(item => item.status === "confirmed").length,
    pending: proofs.filter(item => ["queued", "processing", "failed"].includes(item.status)).length,
    dead: proofs.filter(item => item.status === "dead").length,
  }), [proofs])

  async function load() {
    setLoading(true)
    setMessage("")
    try {
      const [overviewResult, findingsResult, proofsResult] = await Promise.allSettled([
        request<Overview>("/api/staff/admin/ecosystem/overview"),
        request<Finding[]>("/api/staff/admin/ecosystem/findings?limit=50"),
        request<ProofBatch[]>("/api/staff/admin/ecosystem/proofs?limit=25"),
      ])
      if (overviewResult.status === "rejected") throw overviewResult.reason
      const nextOverview = overviewResult.value
      setOverview(nextOverview)
      setFindings(findingsResult.status === "fulfilled" ? findingsResult.value : [])
      setProofs(proofsResult.status === "fulfilled" ? proofsResult.value : [])
      const degraded = [
        findingsResult.status === "rejected" ? "findings" : null,
        proofsResult.status === "rejected" ? "external proofs" : null,
      ].filter(Boolean)
      if (degraded.length) setMessage(`Tryb częściowy: niedostępne ${degraded.join(", ")}.`)
      if (nextOverview.next_event?.slug) {
        try {
          setChecklist(
            await request<Checklist>(
              `/api/staff/admin/ecosystem/checklists/${encodeURIComponent(nextOverview.next_event.slug)}`,
            ),
          )
        } catch {
          setChecklist(null)
          setMessage(previous => previous || "Tryb częściowy: checklista koncertowa niedostępna.")
        }
      } else {
        setChecklist(null)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Control plane niedostępny")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(flag: FeatureFlag) {
    if (busy) return
    setBusy(flag.key)
    setMessage("")
    try {
      await request(`/api/staff/admin/ecosystem/flags/${encodeURIComponent(flag.key)}`, {
        method: "POST",
        body: JSON.stringify({
          enabled: !flag.enabled,
          reason: !flag.enabled ? "enabled from Virya control plane" : "paused from Virya control plane",
        }),
      })
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zmienić flagi")
    } finally {
      setBusy("")
    }
  }

  async function reconcile() {
    if (busy) return
    setBusy("reconcile")
    setMessage("")
    try {
      const result = await request<{ run: ReconciliationRun; findings: Finding[] }>(
        "/api/staff/admin/ecosystem/reconcile",
        { method: "POST", body: JSON.stringify({}) },
      )
      setMessage(
        result.findings.length
          ? `Reconciliation zakończony: ${result.findings.length} problemów.`
          : "Reconciliation zakończony. System jest spójny.",
      )
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconciliation nie powiódł się")
    } finally {
      setBusy("")
    }
  }

  async function createAuditProof() {
    if (busy) return
    setBusy("audit-proof")
    setMessage("")
    try {
      const result = await request<{ batch: ProofBatch | null; replayed: boolean }>(
        "/api/staff/admin/ecosystem/proofs/audit",
        { method: "POST", body: JSON.stringify({ limit: 1024 }) },
      )
      setMessage(result.batch
        ? `Utworzono proof batch: ${result.batch.leaf_count} wpisów audytu.`
        : "Brak nowych wpisów audytu do zakotwiczenia.")
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się utworzyć proof batcha")
    } finally {
      setBusy("")
    }
  }

  async function updateChecklist(item: ChecklistItem) {
    if (!nextEventSlug || busy) return
    const key = `checklist:${item.item_key}`
    setBusy(key)
    try {
      const nextStatus = item.status === "done" ? "pending" : "done"
      const next = await request<Checklist>(
        `/api/staff/admin/ecosystem/checklists/${encodeURIComponent(nextEventSlug)}/${encodeURIComponent(item.item_key)}`,
        {
          method: "POST",
          body: JSON.stringify({ status: nextStatus, note: item.note }),
        },
      )
      setChecklist(next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać checklisty")
    } finally {
      setBusy("")
    }
  }

  return (
    <section class="relative grid gap-5 rounded-3xl border border-amber-300/15 bg-zinc-950/80 p-5 sm:p-6" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram control plane i proofy…" />}
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.28em] text-amber-300">Ecosystem control plane</p>
          <h2 class="mt-2 text-xl font-black text-white">Virya · CrowdRelay · mobile · n8n</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Jedno miejsce do zatrzymywania integracji, sprawdzania spójności i przygotowania bramki przed koncertem.
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={!!busy || loading} class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Odśwież</button>
          <button type="button" onClick={() => void reconcile()} disabled={!!busy} class="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">{busy === "reconcile" ? "Sprawdzam…" : "Uruchom reconciliation"}</button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4"><span class="text-xs text-zinc-500">Otwarte findings</span><strong class="mt-2 block text-2xl text-white">{overview?.open_findings ?? "…"}</strong></div>
        <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4"><span class="text-xs text-zinc-500">Krytyczne</span><strong class={`mt-2 block text-2xl ${critical ? "text-rose-300" : "text-emerald-300"}`}>{critical}</strong></div>
        <div class="rounded-2xl border border-white/10 bg-white/[.03] p-4"><span class="text-xs text-zinc-500">Ostatni przebieg</span><strong class="mt-2 block text-sm text-white">{formatDate(overview?.last_reconciliation?.finished_at)}</strong></div>
      </div>

      <div>
        <h3 class="text-sm font-black uppercase tracking-wider text-zinc-300">Kill switche</h3>
        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {(overview?.flags ?? []).map(flag => (
            <button
              type="button"
              key={flag.key}
              disabled={!!busy}
              onClick={() => void toggle(flag)}
              class={`rounded-2xl border p-4 text-left transition ${flag.enabled ? "border-emerald-400/25 bg-emerald-400/5" : "border-rose-400/25 bg-rose-400/5"}`}
            >
              <span class="text-xs font-black text-white">{labels[flag.key] ?? flag.key}</span>
              <span class={`mt-2 block text-[10px] font-black uppercase tracking-wider ${flag.enabled ? "text-emerald-300" : "text-rose-300"}`}>{busy === flag.key ? "Zapisuję…" : flag.enabled ? "Włączone" : "Wstrzymane"}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 class="text-sm font-black uppercase tracking-wider text-zinc-300">External proofs</h3>
            <p class="mt-1 max-w-3xl text-sm text-zinc-500">Lokalne SHA-256/Merkle receipts są tworzone bez RPC. Izolowany relayer podpisuje rooty i publikuje je w publicznym logu Sigstore Rekor, poza ścieżką sprzedaży, maili i bramki.</p>
          </div>
          <button type="button" onClick={() => void createAuditProof()} disabled={!!busy} class="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 disabled:opacity-50">{busy === "audit-proof" ? "Buduję…" : "Zbuduj proof audytu"}</button>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4"><span class="text-xs text-zinc-500">Potwierdzone w Rekorze</span><strong class="mt-2 block text-2xl text-emerald-300">{proofStats.confirmed}</strong></div>
          <div class="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4"><span class="text-xs text-zinc-500">W kolejce / retry</span><strong class="mt-2 block text-2xl text-cyan-200">{proofStats.pending}</strong></div>
          <div class="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4"><span class="text-xs text-zinc-500">Dead</span><strong class="mt-2 block text-2xl text-rose-300">{proofStats.dead}</strong></div>
        </div>
        {proofs.length > 0 && <div class="mt-3 grid gap-2">
          {proofs.slice(0, 8).map(item => (
            <article key={item.id} class="rounded-xl border border-white/10 bg-white/[.025] p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2"><strong class="text-sm text-white">{item.proof_kind === "draw_receipt" ? "Dowód losowania" : "Audit ledger"}</strong><span class={`text-[10px] font-black uppercase ${item.status === "confirmed" ? "text-emerald-300" : item.status === "dead" ? "text-rose-300" : "text-cyan-200"}`}>{item.status}</span></div>
                <span class="text-xs text-zinc-500">{item.leaf_count} leaves · {formatDate(item.confirmed_at ?? item.created_at)}</span>
              </div>
              <p class="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-zinc-600">SHA-256 {item.root_sha256}</p>
              {item.anchor_kind === "sigstore.rekor.v1" && item.anchor_url && item.anchor_entry_id && /^[0-9a-f]{64,128}$/.test(item.anchor_entry_id)
                ? <a href={`${item.anchor_url.replace(/\/+$/, "")}/api/v1/log/entries/${item.anchor_entry_id}`} target="_blank" rel="noopener noreferrer" class="mt-2 inline-block text-xs font-bold text-cyan-300 hover:text-cyan-200">Rekor #${item.anchor_sequence ?? "—"} ↗</a>
                : item.anchor_entry_id && <p class="mt-2 font-mono text-[10px] text-cyan-300">Entry {item.anchor_entry_id}</p>}
              {item.signer_fingerprint && <p class="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-zinc-600">Signer {item.signer_fingerprint}</p>}
              {item.last_error_kind && <p class="mt-2 text-xs text-rose-300">{item.last_error_kind} · próba {item.attempts}/{item.max_attempts}</p>}
            </article>
          ))}
        </div>}
      </div>

      {checklist && (
        <div>
          <div class="flex flex-wrap items-end justify-between gap-2">
            <div><h3 class="text-sm font-black uppercase tracking-wider text-zinc-300">Najbliższy koncert</h3><p class="mt-1 text-sm text-zinc-500">{checklist.event_title} · {formatDate(checklist.starts_at)}</p></div>
            <span class="text-xs text-zinc-500">{checklist.items.filter(item => item.status === "done").length}/{checklist.items.length}</span>
          </div>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            {checklist.items.map(item => (
              <button type="button" key={item.item_key} disabled={!!busy} onClick={() => void updateChecklist(item)} class={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${item.status === "done" ? "border-emerald-400/25 bg-emerald-400/5" : item.status === "blocked" ? "border-rose-400/25 bg-rose-400/5" : "border-white/10 bg-white/[.025]"}`}>
                <span class="text-sm font-bold text-white">{checklistLabels[item.item_key] ?? item.item_key}</span>
                <span class="text-[10px] font-black uppercase text-zinc-500">{busy === `checklist:${item.item_key}` ? "…" : item.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {findings.length > 0 && (
        <div>
          <h3 class="text-sm font-black uppercase tracking-wider text-zinc-300">Niespójności</h3>
          <div class="mt-3 grid gap-2">
            {findings.slice(0, 8).map(item => (
              <article key={item.id} class={`rounded-xl border p-4 ${item.severity === "critical" ? "border-rose-400/25 bg-rose-400/5" : "border-amber-300/20 bg-amber-300/5"}`}>
                <div class="flex flex-wrap items-center gap-2"><strong class="text-sm text-white">{item.kind}</strong><span class="text-[10px] font-black uppercase text-zinc-500">{item.severity}</span></div>
                <p class="mt-2 text-sm text-zinc-400">{item.summary}</p>
                {(item.entity_label || item.suggested_action) && <p class="mt-2 font-mono text-[10px] text-zinc-600">{item.entity_label ?? "—"} · {item.suggested_action ?? "inspect"}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {message && <p role="status" class="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{message}</p>}
    </section>
  )
}
