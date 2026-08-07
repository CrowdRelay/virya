type BackendLoaderProps = {
  label?: string
  overlay?: boolean
}

export default function BackendLoader({
  label = "Pobieram dane z backendu…",
  overlay = false,
}: BackendLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      class={
        overlay
          ? "absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-zinc-950/70 p-6 backdrop-blur-[2px]"
          : "flex min-h-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-5"
      }
    >
      <span class="flex items-center gap-3 rounded-full border border-white/10 bg-zinc-950/90 px-4 py-3 text-sm font-bold text-zinc-200 shadow-xl">
        <span
          aria-hidden="true"
          class="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-amber-300"
        />
        {label}
      </span>
    </div>
  )
}
