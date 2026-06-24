import { useEffect, useRef, useCallback, useState } from "preact/hooks"
import { useI18n } from "../../../i18n/I18nContext"

const SCRIPT_SRC = "https://geowidget.inpost.pl/inpost-geowidget.js"
const STYLE_HREF = "https://geowidget.inpost.pl/inpost-geowidget.css"
const TOKEN = import.meta.env.PUBLIC_INPOST_GEOWIDGET_TOKEN || ""
const CALLBACK_NAME = "viryaAfterPointSelected"

const normalizePoint = (p) => {
  if (!p) return null
  const address = p.address
    ? [p.address.line1, p.address.line2].filter(Boolean).join(", ")
    : p.address_details
    ? `${p.address_details.street || ""} ${p.address_details.building_number || ""}, ${p.address_details.city || ""}`.trim()
    : ""
  return { code: p.name || p.id || "", description: p.location_description || "", address }
}

const ensureAssets = () => {
  if (typeof document === "undefined") return
  if (!document.querySelector(`link[href="${STYLE_HREF}"]`)) {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = STYLE_HREF
    document.head.appendChild(link)
  }
  if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    document.head.appendChild(script)
  }
}

const InpostGeowidget = ({ open, onClose, onSelect }) => {
  const { t, lang } = useI18n()
  const hostRef = useRef(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const handlePoint = useCallback((point) => {
    const normalized = normalizePoint(point)
    if (!normalized || !normalized.code) return
    onSelect(normalized)
    onClose()
  }, [onSelect, onClose])

  useEffect(() => {
    if (!open) return
    ensureAssets()
    
    // Wait for script to load and custom element to be defined
    const checkScript = setInterval(() => {
      if (typeof window !== "undefined" && customElements.get('inpost-geowidget')) {
        setScriptLoaded(true)
        clearInterval(checkScript)
      }
    }, 100)

    // Fallback timeout after 5 seconds
    const timeout = setTimeout(() => {
      setScriptLoaded(true)
      clearInterval(checkScript)
    }, 5000)

    return () => {
      clearInterval(checkScript)
      clearTimeout(timeout)
    }
  }, [open])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Wire the geowidget "select" callback. In geowidget v5 the `onpoint`
  // attribute names a CustomEvent the widget DISPATCHES (point in e.detail) —
  // it is not a window function it calls. Preact intercepts any on* prop as an
  // event handler, so the attribute is set imperatively on the element. We
  // listen for that event on both the element and document, and also expose a
  // global function of the same name to cover builds that call it directly.
  useEffect(() => {
    if (!open || !scriptLoaded) return
    const el = hostRef.current
    if (!el) return

    const listener = (e) => handlePoint(e?.detail ?? e)
    el.setAttribute("onpoint", CALLBACK_NAME)
    el.addEventListener(CALLBACK_NAME, listener)
    document.addEventListener(CALLBACK_NAME, listener)
    window[CALLBACK_NAME] = (point) => handlePoint(point)

    return () => {
      el.removeEventListener(CALLBACK_NAME, listener)
      document.removeEventListener(CALLBACK_NAME, listener)
      if (window[CALLBACK_NAME]) delete window[CALLBACK_NAME]
    }
  }, [open, scriptLoaded, handlePoint])

  if (!open) return null

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("cart.choosePaczkomatTitle")}
      onClick={onClose}
    >
      <div class="relative w-full max-w-3xl h-[80vh] bg-zinc-950 border border-zinc-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <p class="text-xs font-bold uppercase tracking-widest text-zinc-300">{t("cart.choosePaczkomatTitle")}</p>
          <button onClick={onClose} aria-label={t("cart.close")} class="text-zinc-500 hover:text-amber-400 transition-colors text-xl leading-none">&times;</button>
        </div>
        <div class="flex-1 overflow-hidden relative z-10 pointer-events-auto">
          {!scriptLoaded ? (
            <div class="h-full flex items-center justify-center">
              <p class="text-sm text-zinc-400">{t("cart.loading")}</p>
            </div>
          ) : TOKEN ? (
            <inpost-geowidget
              ref={hostRef}
              token={TOKEN}
              language={lang === "pl" ? "pl" : "en"}
              config="parcelCollect"
              style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 10 }}
            />
          ) : (
            <div class="h-full flex items-center justify-center text-center px-6">
              <p class="text-sm text-zinc-400">
                {t("cart.widgetMissing")}{" "}
                <code class="text-amber-400">PUBLIC_INPOST_GEOWIDGET_TOKEN</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InpostGeowidget
