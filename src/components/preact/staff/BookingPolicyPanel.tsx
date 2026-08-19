import { useEffect, useState } from "preact/hooks"
import { staffApi, type StaffApiError } from "./staffApi"

const REQUEST_TIMEOUT_MS = 10_000

export type BookingPolicy = {
  annual_target: number
  annual_stretch: number
  stretch_minimum_score_basis_points: number
  prefer_weekend_one_shots: boolean
  priority_markets: string[]
  far_shot_minimum_score_basis_points: number
}

export type BookingPolicySummary = {
  policy: BookingPolicy
  source: string
  source_revision: string | null
  version: number
  synced_at: string | null
}

type Props = {
  summary: BookingPolicySummary | null
  onSaved: () => Promise<void> | void
}

const percent = (basisPoints: number) => Math.round(basisPoints / 100)
const clampInt = (value: string, min: number, max: number) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min
}
const normalizeMarkets = (value: string) =>
  [...new Set(value.toUpperCase().split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))]

export default function BookingPolicyPanel({ summary, onSaved }: Props) {
  const [target, setTarget] = useState("15")
  const [stretch, setStretch] = useState("20")
  const [stretchScore, setStretchScore] = useState("90")
  const [farShotScore, setFarShotScore] = useState("90")
  const [markets, setMarkets] = useState("PL, DE-EAST, CZ, SK")
  const [weekend, setWeekend] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")

  useEffect(() => {
    if (!summary) return
    setTarget(String(summary.policy.annual_target))
    setStretch(String(summary.policy.annual_stretch))
    setStretchScore(String(percent(summary.policy.stretch_minimum_score_basis_points)))
    setFarShotScore(String(percent(summary.policy.far_shot_minimum_score_basis_points)))
    setMarkets(summary.policy.priority_markets.join(", "))
    setWeekend(summary.policy.prefer_weekend_one_shots)
  }, [summary?.version])

  async function save() {
    if (!summary || busy) return
    const annualTarget = clampInt(target, 1, 60)
    const annualStretch = clampInt(stretch, 1, 60)
    const priorityMarkets = normalizeMarkets(markets)
    if (annualStretch < annualTarget) {
      setError("Stretch nie może być niższy niż główny cel koncertowy.")
      return
    }
    if (priorityMarkets.length < 1 || priorityMarkets.length > 12 || priorityMarkets.some(market => !/^[A-Z0-9-]{1,24}$/.test(market))) {
      setError("Rynki: 1–12 kodów, np. PL, DE-EAST, CZ. Tylko A–Z, cyfry i myślnik.")
      return
    }
    setBusy(true)
    setError("")
    setSaved("")
    try {
      await staffApi("/api/staff/admin/autopilot", {
        method: "POST",
        timeoutMs: REQUEST_TIMEOUT_MS,
        body: {
          operation: "set_booking_policy",
          expected_version: summary.version,
          policy: {
            annual_target: annualTarget,
            annual_stretch: annualStretch,
            stretch_minimum_score_basis_points: clampInt(stretchScore, 0, 100) * 100,
            prefer_weekend_one_shots: weekend,
            priority_markets: priorityMarkets,
            far_shot_minimum_score_basis_points: clampInt(farShotScore, 0, 100) * 100,
          },
        },
      })
      setSaved("Zapisane w CrowdRelay. Autopilot użyje tej wersji przy kolejnych decyzjach bookingowych.")
      await onSaved()
    } catch (value) {
      const failure = value as StaffApiError
      setError(failure?.status === 409
        ? "Polityka została zmieniona w innym miejscu. Odświeżono stan — sprawdź wartości i zapisz ponownie."
        : value instanceof Error ? value.message : "Nie udało się zapisać polityki bookingowej")
      if (failure?.status === 409) await onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="mt-6 border-t border-white/10 pt-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Booking manager · guardrails</p>
          <h3 class="mt-1 text-lg font-black text-white">Ile gramy i gdzie autopilot ma cisnąć</h3>
          <p class="mt-1 max-w-3xl text-sm text-zinc-400">To trwała polityka w CrowdRelay, nie lokalne ustawienie panelu. Konflikt wersji blokuje nadpisanie nowszych decyzji.</p>
        </div>
        {summary && <span class="rounded-full border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">v{summary.version} · {summary.source}</span>}
      </div>

      {!summary ? (
        <p class="mt-4 rounded-lg bg-black/20 p-4 text-sm text-zinc-500">Polityka bookingowa jest chwilowo niedostępna.</p>
      ) : (
        <div class="mt-4 grid gap-4">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PolicyNumber label="Cel / rok" value={target} min={1} max={60} onInput={setTarget} />
            <PolicyNumber label="Stretch / rok" value={stretch} min={1} max={60} onInput={setStretch} />
            <PolicyNumber label="Próg stretch %" value={stretchScore} min={0} max={100} onInput={setStretchScore} />
            <PolicyNumber label="Próg far-shot %" value={farShotScore} min={0} max={100} onInput={setFarShotScore} />
          </div>
          <label class="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
            Rynki priorytetowe
            <input
              value={markets}
              onInput={event => setMarkets(event.currentTarget.value)}
              spellcheck={false}
              class="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-amber-300/60"
              placeholder="PL, DE-EAST, CZ, SK"
            />
          </label>
          <label class="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
            <input type="checkbox" checked={weekend} onChange={event => setWeekend(event.currentTarget.checked)} class="h-5 w-5 accent-amber-300" />
            Preferuj sensowne weekendowe one-shoty poza trasą
          </label>
          {error && <p role="alert" class="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
          {saved && <p role="status" class="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{saved}</p>}
          <div>
            <button type="button" disabled={busy} onClick={() => void save()} class="min-h-11 rounded-xl bg-amber-300 px-5 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">
              {busy ? "ZAPISUJĘ…" : "ZAPISZ POLITYKĘ BOOKINGOWĄ"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PolicyNumber({ label, value, min, max, onInput }: { label: string; value: string; min: number; max: number; onInput: (value: string) => void }) {
  return (
    <label class="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onInput={event => onInput(event.currentTarget.value)}
        class="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zinc-100 outline-none focus:border-amber-300/60"
      />
    </label>
  )
}
