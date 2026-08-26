import { useEffect, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"

// Jeden ekran „bramki” dla całego panelu staff: wcześniej każda z 6 powierzchni
// rysowała własny status i własny formularz logowania, każdy z innym brzmieniem.
export function StaffStatusCard({
  title,
  body,
  loading = false,
}: {
  title: string
  body?: string
  loading?: boolean
}) {
  return (
    <section class="relative mx-auto min-h-40 max-w-xl rounded-xl border border-white/10 bg-zinc-900/80 p-8" aria-busy={loading}>
      {loading && <BackendLoader overlay label={title} />}
      <h1 class="text-2xl font-black text-white">{title}</h1>
      {body && <p class="mt-3 leading-6 text-zinc-400">{body}</p>}
    </section>
  )
}

export function StaffLoginCard({
  eyebrow,
  title,
  description,
  passwordRef,
  password,
  onPasswordInput,
  busy,
  message,
  onSubmit,
  submitLabel = "ZALOGUJ",
  busyLabel = "LOGUJĘ…",
}: {
  eyebrow: string
  title: string
  description: string
  passwordRef?: preact.Ref<HTMLInputElement>
  password: string
  onPasswordInput: (value: string) => void
  busy: boolean
  message?: NoticeState
  onSubmit: (event: SubmitEvent) => void
  submitLabel?: string
  busyLabel?: string
}) {
  return (
    <section class="mx-auto max-w-lg rounded-xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
      <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">{eyebrow}</p>
      <h1 class="mt-3 text-3xl font-black text-white">{title}</h1>
      <p class="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
      <form onSubmit={event => onSubmit(event as SubmitEvent)} class="mt-6 grid gap-4">
        <label class="text-sm font-semibold text-zinc-200">
          Hasło staff
          <input
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={password}
            maxLength={256}
            required
            onInput={event => onPasswordInput(event.currentTarget.value)}
            class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition-colors focus:border-amber-300"
          />
        </label>
        <button disabled={busy || !password} class="min-h-[48px] w-full rounded-xl bg-emerald-300 px-5 text-sm font-black uppercase tracking-wider text-zinc-950 transition-colors hover:bg-emerald-200 disabled:opacity-50">
          {busy ? busyLabel : submitLabel}
        </button>
      </form>
      {message ? <div class="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
    </section>
  )
}

export function Field({
  label,
  value,
  onInput,
  type = "text",
  maxLength,
  min,
  max,
  step,
  required = true,
  autocomplete,
}: {
  label: string
  value: string
  onInput: (value: string) => void
  type?: string
  maxLength?: number
  min?: string
  max?: string
  step?: string
  required?: boolean
  autocomplete?: string
}) {
  return (
    <label class="text-sm font-semibold text-zinc-200">
      {label}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        required={required}
        autocomplete={autocomplete}
        onInput={event => onInput(event.currentTarget.value)}
        class="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition-colors focus:border-amber-300"
      />
    </label>
  )
}

export function Metric({
  label,
  value,
  ok = true,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <div
      class={`rounded-lg border p-4 ${ok ? "border-white/10 bg-zinc-900/70" : "border-rose-400/35 bg-rose-400/10"}`}
    >
      <p class="text-xs font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p class="mt-2 text-xl font-black tabular-nums text-white">{value}</p>
    </div>
  )
}

// Jeden baner na cały panel: sukces, błąd i ostrzeżenie muszą wyglądać
// inaczej — wcześniej „Zapisano.” i awaria miały ten sam bursztynowy kolor.
export type NoticeTone = "success" | "error" | "warn" | "info"
export type NoticeState = { tone: NoticeTone; text: string } | null

const NOTICE_TONES = {
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  warn: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  info: "border-white/10 bg-white/5 text-zinc-300",
} as const

export function Notice({
  tone,
  children,
}: {
  tone: keyof typeof NOTICE_TONES
  children: preact.ComponentChildren
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      class={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${NOTICE_TONES[tone]}`}
    >
      {children}
    </p>
  )
}

// Potwierdzenie dwuklikiem w miejscu (ten sam wzorzec co kolejka agenta):
// pierwsze kliknięcie uzbraja, drugie wykonuje, brak ruchu przez 4 s rozbraja.
// Zastępuje window.confirm, który na telefonie łatwo pominąć odruchem.
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "NA PEWNO?",
  busyLabel = "ZAPISUJĘ…",
  busy = false,
  disabled = false,
}: {
  onConfirm: () => void
  children: preact.ComponentChildren
  confirmLabel?: string
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={() => {
        if (busy || disabled) return
        if (armed) {
          setArmed(false)
          onConfirm()
          return
        }
        setArmed(true)
      }}
      class={
        armed
          ? "min-h-[44px] rounded-lg border border-rose-400/50 bg-rose-400/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-100 transition-colors disabled:opacity-50"
          : "min-h-[44px] rounded-lg border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-200 transition-colors hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
      }
    >
      {busy ? busyLabel : armed ? confirmLabel : children}
    </button>
  )
}
