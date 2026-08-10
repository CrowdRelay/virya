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
      class={`rounded-2xl border p-4 ${ok ? "border-white/10 bg-zinc-900/70" : "border-rose-400/35 bg-rose-400/10"}`}
    >
      <p class="text-xs font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p class="mt-2 text-xl font-black tabular-nums text-white">{value}</p>
    </div>
  )
}
