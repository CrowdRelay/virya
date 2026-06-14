"use client"
import React, { useEffect, useRef, useCallback } from "react"

// InPost Geowidget v5. The map renders as a custom element <inpost-geowidget>.
// IMPORTANT: the "Wybierz"/select button only becomes active when the widget can
// hand the chosen point back to a GLOBAL callback whose name is given in the
// `onpoint` attribute. (Listening for an "onpoint" DOM event alone leaves the
// select button disabled.) So we expose a stable global function here and route
// it to the currently-mounted component.
// Docs: https://docs.inpost.pl/ (Geowidget v5)
const SCRIPT_SRC = "https://geowidget.inpost.pl/inpost-geowidget.js"
const STYLE_HREF = "https://geowidget.inpost.pl/inpost-geowidget.css"
const TOKEN = process.env.GATSBY_INPOST_GEOWIDGET_TOKEN || ""
const CALLBACK_NAME = "viryaAfterPointSelected"

// Module-level handler the global callback forwards to. Set while the picker is mounted.
let activeHandler = null

const normalizePoint = p => {
  if (!p) return null
  const address = p.address
    ? [p.address.line1, p.address.line2].filter(Boolean).join(", ")
    : p.address_details
    ? `${p.address_details.street || ""} ${
        p.address_details.building_number || ""
      }, ${p.address_details.city || ""}`.trim()
    : ""
  return {
    code: p.name || p.id || "",
    description: p.location_description || p.location_description_1 || "",
    address,
  }
}

// Register the global callback the widget invokes when "Wybierz" is clicked.
if (typeof window !== "undefined") {
  window[CALLBACK_NAME] = point => {
    if (activeHandler) activeHandler(point)
  }
}

// Inject the widget's script + stylesheet once per page load.
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
    script.defer = true
    document.head.appendChild(script)
  }
}

const InpostGeowidget = ({ open, onClose, onSelect }) => {
  const hostRef = useRef(null)

  const handlePoint = useCallback(
    point => {
      const normalized = normalizePoint(point)
      if (!normalized || !normalized.code) return
      onSelect(normalized)
      onClose()
    },
    [onSelect, onClose]
  )

  useEffect(() => {
    if (!open) return
    ensureAssets()
  }, [open])

  // Route the global callback (and a fallback DOM event) to this instance.
  useEffect(() => {
    if (!open) return
    activeHandler = handlePoint
    const host = hostRef.current
    const onEvent = e => handlePoint(e.detail)
    if (host) host.addEventListener("onpoint", onEvent)
    return () => {
      if (activeHandler === handlePoint) activeHandler = null
      if (host) host.removeEventListener("onpoint", onEvent)
    }
  }, [open, handlePoint])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an InPost Paczkomat"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl h-[80vh] bg-zinc-950 border border-zinc-800 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            Choose your Paczkomat
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-500 hover:text-amber-400 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {TOKEN ? (
            // eslint-disable-next-line react/no-unknown-property
            <inpost-geowidget
              ref={hostRef}
              token={TOKEN}
              language="pl"
              config="parcelCollect"
              onpoint={CALLBACK_NAME}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6">
              <p className="text-sm text-zinc-400">
                InPost map unavailable — set{" "}
                <code className="text-amber-400">
                  GATSBY_INPOST_GEOWIDGET_TOKEN
                </code>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InpostGeowidget
