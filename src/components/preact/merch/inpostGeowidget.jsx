import { useEffect, useRef, useState } from "preact/hooks"
import { useI18n } from "../../../i18n/I18nContext"

const SCRIPT_SRC = "https://geowidget.inpost.pl/inpost-geowidget.js"
const STYLE_HREF = "https://geowidget.inpost.pl/inpost-geowidget.css"
const TOKEN = import.meta.env.PUBLIC_INPOST_GEOWIDGET_TOKEN || ""
const CB_NAME = "__viryaGeopointCb"

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
  const containerRef = useRef(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Lock body scroll while open
  useEffect(() => {
    if (typeof document === "undefined" || !open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  // Load InPost script, wait for custom element to register
  useEffect(() => {
    if (!open) return
    ensureAssets()

    const check = setInterval(() => {
      if (customElements.get("inpost-geowidget")) {
        setScriptLoaded(true)
        clearInterval(check)
      }
    }, 100)
    const fallback = setTimeout(() => { setScriptLoaded(true); clearInterval(check) }, 5000)

    return () => { clearInterval(check); clearTimeout(fallback) }
  }, [open])

  // Create the widget element imperatively so we can set the onpoint attribute
  // BEFORE appending to DOM — the widget reads it in connectedCallback and uses
  // window[onpoint](point) as its callback mechanism (closed shadow DOM, so
  // CustomEvent listeners on the host don't fire from inside the shadow).
  useEffect(() => {
    if (!open || !scriptLoaded || !TOKEN) return
    const container = containerRef.current
    if (!container) return

    window[CB_NAME] = (point) => {
      const normalized = normalizePoint(point)
      if (!normalized || !normalized.code) return
      onSelect(normalized)
      onClose()
    }

    const widget = document.createElement("inpost-geowidget")
    widget.setAttribute("token", TOKEN)
    widget.setAttribute("language", lang === "pl" ? "pl" : "en")
    widget.setAttribute("config", "parcelCollect")
    widget.setAttribute("onpoint", CB_NAME)
    widget.style.cssText = "width:100%;height:100%;display:block"

    container.appendChild(widget)

    return () => {
      if (container.contains(widget)) container.removeChild(widget)
      delete window[CB_NAME]
    }
  }, [open, scriptLoaded, lang, onSelect, onClose])

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
          <button onClick={onClose} aria-label={t("cart.close")} class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-amber-400 transition-colors text-xl leading-none cursor-pointer">&times;</button>
        </div>
        <div class="flex-1 overflow-hidden" ref={containerRef}>
          {!scriptLoaded && (
            <div class="h-full flex items-center justify-center">
              <p class="text-sm text-zinc-400">{t("cart.loading")}</p>
            </div>
          )}
          {!TOKEN && scriptLoaded && (
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
