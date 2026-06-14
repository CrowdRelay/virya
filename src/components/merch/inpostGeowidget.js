"use client"
import React, { useEffect, useRef, useState } from "react"

// InPost Geowidget v5. The map renders as a custom element <inpost-geowidget>
// and emits an "onpoint" CustomEvent when the user picks a locker.
// Docs: https://docs.inpost.pl/ (Geowidget v5)
const SCRIPT_SRC = "https://geowidget.inpost.pl/inpost-geowidget.js"
const STYLE_HREF = "https://geowidget.inpost.pl/inpost-geowidget.css"
const TOKEN = process.env.GATSBY_INPOST_GEOWIDGET_TOKEN || ""

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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    ensureAssets()
    setReady(true)
  }, [open])

  // Bind the "onpoint" selection event to the custom element.
  useEffect(() => {
    if (!open || !ready) return
    const host = hostRef.current
    if (!host) return

    const handlePoint = e => {
      const p = e.detail || {}
      const address = p.address
        ? [p.address.line1, p.address.line2].filter(Boolean).join(", ")
        : p.address_details
        ? `${p.address_details.street || ""} ${
            p.address_details.building_number || ""
          }, ${p.address_details.city || ""}`.trim()
        : ""
      onSelect({
        code: p.name || p.id || "",
        description: p.location_description || p.location_description_1 || "",
        address,
      })
      onClose()
    }

    host.addEventListener("onpoint", handlePoint)
    return () => host.removeEventListener("onpoint", handlePoint)
  }, [open, ready, onSelect, onClose])

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
