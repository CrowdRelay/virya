type BackendLoaderProps = {
  label?: string
  overlay?: boolean
  /** Rough shape of what is coming, so the placeholder matches the payload. */
  rows?: number
}

// Panels used to fade out behind a blur and float a spinner on top, which read
// as "something is stuck" and hid whatever was already on screen. A skeleton
// shows the shape of the answer instead, and the label stays for screen readers.

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div class="grid gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} class="grid gap-2">
          <div
            class="h-3 animate-pulse rounded bg-white/10"
            style={{ width: `${[38, 52, 45, 60, 33][index % 5]}%` }}
          />
          <div class="h-9 animate-pulse rounded-lg bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}

export default function BackendLoader({
  label = "Pobieram dane z backendu…",
  overlay = false,
  rows = 3,
}: BackendLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      class={
        overlay
          ? "absolute inset-0 z-20 overflow-hidden rounded-xl border border-white/10 bg-[#070908] p-6"
          : "rounded-xl border border-white/10 bg-black/30 p-5"
      }
    >
      <span class="sr-only">{label}</span>
      <SkeletonRows rows={rows} />
    </div>
  )
}
