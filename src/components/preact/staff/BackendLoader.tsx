import { staffPanel, staffSkeleton, staffSkeletonBlock } from "./staffUi"

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
            class={`h-3 ${staffSkeleton}`}
            style={{ width: `${[38, 52, 45, 60, 33][index % 5]}%` }}
          />
          <div class={`h-9 ${staffSkeletonBlock}`} />
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
          ? "absolute inset-0 z-20 overflow-hidden rounded-lg border border-virya-edge bg-[var(--virya-bg)] p-6"
          : staffPanel
      }
    >
      <span class="sr-only">{label}</span>
      <SkeletonRows rows={rows} />
    </div>
  )
}
