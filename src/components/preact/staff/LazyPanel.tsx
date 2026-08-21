import type { ComponentType } from "preact"
import { useEffect, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"

type PanelProps = Record<string, unknown>
export type Panel = ComponentType<PanelProps>

// The console used to ship every section in the first script the browser
// parsed, so opening "Dzisiaj" paid for ticketing, audience and the Latarnik
// network too. Sections are fetched when they are first opened and kept for
// the rest of the session, and the tab strip warms them on hover.
const loaded = new Map<string, Panel>()
const inflight = new Map<string, Promise<Panel>>()

export const warmPanel = (id: string, load: () => Promise<Panel>): Promise<Panel> => {
  const ready = loaded.get(id)
  if (ready) return Promise.resolve(ready)
  const running = inflight.get(id)
  if (running) return running
  const started = load().then(panel => {
    loaded.set(id, panel)
    inflight.delete(id)
    return panel
  })
  started.catch(() => inflight.delete(id))
  inflight.set(id, started)
  return started
}

export default function LazyPanel({
  id,
  label,
  load,
  props = {},
}: {
  id: string
  label: string
  load: () => Promise<Panel>
  props?: PanelProps
}) {
  const [panel, setPanel] = useState<Panel | null>(() => loaded.get(id) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ready = loaded.get(id)
    if (ready) {
      setPanel(() => ready)
      return
    }
    let alive = true
    setPanel(null)
    setFailed(false)
    warmPanel(id, load).then(
      next => alive && setPanel(() => next),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [id])

  if (failed) {
    return (
      <p role="alert" class="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        Nie udało się wczytać tej sekcji. Odśwież stronę.
      </p>
    )
  }
  if (!panel) {
    return (
      <div class="relative min-h-48">
        <BackendLoader overlay label={label} />
      </div>
    )
  }
  const Panel = panel
  return <Panel {...props} />
}
