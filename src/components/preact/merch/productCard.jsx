import { useState, useEffect, useRef, useCallback } from "preact/hooks"
import { useCartActions } from "./cartContext"
import BlurImg from "../BlurImg"
import { useI18n } from "../../../i18n/I18nContext"
import {
  discountedPrice,
  sizeInStock,
  productInStock,
  productLowStock,
  sizeLowStock,
  isBundle,
  SIZE_CHART,
  inventoryAvailability,
} from "../../../data/products"

const ProductCard = ({ product, images, index = 0, inventory }) => {
  const { add } = useCartActions()
  const { t, lang } = useI18n()
  const [size, setSize] = useState(null)
  const [hovered, setHovered] = useState(false)
  const [error, setError] = useState(false)
  const [requested, setRequested] = useState([])
  const [notice, setNotice] = useState("")
  const [announce, setAnnounce] = useState("")
  const [zoomed, setZoomed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)
  const dragXRef = useRef(0)
  const cardRef = useRef(null)

  const frontSrc = images[product.front]
  const backSrc = product.back ? images[product.back] : null
  const bundle = isBundle(product)
  const showBack = hovered && !!backSrc
  const needsSize = Array.isArray(product.sizes)
  const inventoryState = inventoryAvailability(
    product,
    size,
    inventory?.status === "ready" ? inventory.variants : null,
  )
  const available = inventoryState?.available ?? productInStock(product)
  const priceOverride = inventory?.prices?.[product.id]
  const price =
    Number.isInteger(priceOverride?.price_gross_minor) &&
    String(priceOverride?.currency || "PLN").toUpperCase() === "PLN"
      ? priceOverride.price_gross_minor / 100
      : discountedPrice(product)
  const onSale = price < product.price
  const priceDiscountPct = onSale && product.price > 0
    ? Math.max(1, Math.round((1 - price / product.price) * 100))
    : 0
  const lowStock = inventoryState?.lowStock ?? productLowStock(product)
  const selectedInventoryState = needsSize && size
    ? inventoryAvailability(
        product,
        size,
        inventory?.status === "ready" ? inventory.variants : null,
      )
    : null
  const selectedLow = needsSize && size
    ? selectedInventoryState?.lowStock ?? sizeLowStock(product, size)
    : false
  const blurb = lang === "pl" && product.blurb_pl ? product.blurb_pl : product.blurb
  const includes = lang === "pl" && product.includes_pl ? product.includes_pl : product.includes
  const name = lang === "pl" && product.name_pl ? product.name_pl : product.name
  const zoomSrcs = (bundle || backSrc ? [frontSrc, backSrc] : [frontSrc]).filter(Boolean)

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swiping.current = false
    setDragging(true)
    setDragX(0)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (zoomSrcs.length < 2) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) swiping.current = true
    if (!swiping.current) return
    const atStart = slide === 0 && dx > 0
    const atEnd = slide === zoomSrcs.length - 1 && dx < 0
    const next = atStart || atEnd ? dx * 0.35 : dx
    dragXRef.current = next
    setDragX(next)
  }, [zoomSrcs.length, slide])

  const handleTouchEnd = useCallback(() => {
    setDragging(false)
    const dx = dragXRef.current
    dragXRef.current = 0
    setDragX(0)
    if (zoomSrcs.length > 1 && Math.abs(dx) > 60) {
      if (dx > 0) setSlide((s) => Math.max(0, s - 1))
      else setSlide((s) => Math.min(zoomSrcs.length - 1, s + 1))
    }
  }, [zoomSrcs.length])

  const handleAdd = () => {
    if (!available) return
    if (needsSize && !size) { setError(true); return }
    setError(false)
    add(product.id, size, 1)
    setAnnounce(t("product.added", name))
  }

  useEffect(() => {
    if (!guideOpen && !zoomed) return
    const dialog = cardRef.current?.querySelector('[role="dialog"]')
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const onKey = (e) => {
      if (e.key === "Escape") { setGuideOpen(false); setZoomed(false); setSlide(0) }
      if (e.key === "Tab" && dialog) {
        const items = Array.from(dialog.querySelectorAll(focusableSelector)).filter((item) => item.offsetParent !== null)
        const first = items[0]
        const last = items[items.length - 1]
        if (first && e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (last && !e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      if (zoomed && zoomSrcs.length > 1) {
        if (e.key === "ArrowRight") setSlide((s) => (s + 1) % zoomSrcs.length)
        if (e.key === "ArrowLeft") setSlide((s) => (s - 1 + zoomSrcs.length) % zoomSrcs.length)
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    requestAnimationFrame(() => dialog?.querySelector(focusableSelector)?.focus())
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      if (returnFocus?.isConnected) returnFocus.focus()
    }
  }, [guideOpen, zoomed, zoomSrcs.length])

  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(""), 1000)
    return () => clearTimeout(id)
  }, [announce])

  const requestSize = async (s) => {
    if (requested.includes(s)) return
    setRequested((prev) => [...prev, s])
    setNotice(t("product.restock", s))
    try {
      await fetch("/api/size-demand", {
        method: "POST",
        signal: AbortSignal.timeout(6_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, size: s }),
      })
    } catch {}
  }

  const imgClass = (hidden) =>
    `block w-full h-auto transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"} ${available ? "" : "grayscale"}`

  return (
    <div id={`merch-${product.id}`} tabIndex={-1} ref={cardRef} class={`group flex flex-col overflow-hidden border border-zinc-800/80 bg-zinc-900/30 transition-colors duration-200 hover:border-amber-400/35 focus:border-amber-300 focus:outline-none ${available ? "" : "opacity-60"}`}>
      <div
        class="relative overflow-hidden bg-zinc-950"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {frontSrc && (
          <BlurImg
            src={frontSrc}
            alt={product.name}
            loading={index === 0 ? "eager" : "lazy"}
            fetchpriority={index === 0 ? "high" : undefined}
            decoding="async"
            width="400"
            height="400"
            sizes="(max-width: 519px) calc(100vw - 2.5rem), (max-width: 1023px) calc((100vw - 4.5rem) / 2), 380px"
            class={imgClass(showBack)}
          />
        )}
        {backSrc && (
          <BlurImg
            src={backSrc}
            alt={`${product.name} — back`}
            loading="lazy"
            decoding="async"
            width="400"
            height="400"
            sizes="(max-width: 519px) calc(100vw - 2.5rem), (max-width: 1023px) calc((100vw - 4.5rem) / 2), 380px"
            class={`absolute inset-0 ${imgClass(!showBack)}`}
          />
        )}
        {frontSrc && (
          <button type="button" onClick={() => { setSlide(0); setZoomed(true) }} aria-label={t("product.zoomAria", name)} class="absolute inset-0 z-10 cursor-zoom-in" />
        )}
        <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
          {bundle && <span class="text-[11px] font-black uppercase tracking-widest text-black bg-zinc-100 px-2 py-1">{t("product.bundle")}</span>}
          {onSale && <span class="text-[11px] font-black uppercase tracking-widest text-black bg-amber-400 px-2 py-1">−{priceDiscountPct}%</span>}
        </div>
        {available && lowStock && (
          <span class="absolute bottom-2 left-2 text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-black/70 px-2 py-1 backdrop-blur-sm">{t("product.lowStock")}</span>
        )}
        {!available && (
          <span class="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-black uppercase tracking-widest text-zinc-200">{t("product.soldOut")}</span>
        )}
        {backSrc && (
          <span class="absolute bottom-3 right-3 flex gap-1.5 bg-black/55 px-2 py-1.5" aria-hidden="true">
            <span class={`h-1.5 w-1.5 rounded-full ${showBack ? "bg-zinc-500" : "bg-white"}`} />
            <span class={`h-1.5 w-1.5 rounded-full ${showBack ? "bg-white" : "bg-zinc-500"}`} />
          </span>
        )}
      </div>

      <div class="flex flex-1 flex-col p-5 sm:p-5 lg:p-6">
        <h2 class="text-base font-black uppercase leading-tight tracking-[.02em] text-zinc-100 lg:text-lg">{name}</h2>
        <p class={`mt-2 text-sm leading-6 text-zinc-400 ${bundle || product.spotifyId ? "mb-3" : "mb-4 flex-1"}`}>{blurb}</p>

        {bundle && Array.isArray(includes) && (
          <ul class="mb-4 flex-1 space-y-1">
            {includes.map((inc) => (
              <li key={inc} class="flex items-center gap-2 text-[11px] text-zinc-300">
                <span class="text-amber-400" aria-hidden="true">+</span>{inc}
              </li>
            ))}
          </ul>
        )}

        {product.spotifyId && (
          <a
            href={`https://open.spotify.com/album/${product.spotifyId}`}
            target="_blank"
            rel="noopener noreferrer"
            class="mb-4 inline-flex min-h-11 items-center gap-2 self-start text-[11px] font-black uppercase tracking-[.14em] text-amber-400 transition-colors hover:text-amber-300"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t("product.listen")} <span aria-hidden="true">↗</span>
          </a>
        )}

        {needsSize && (
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{t("product.size")}</p>
              <button type="button" onClick={() => setGuideOpen(true)} class="hidden sm:inline-flex min-h-[44px] items-center text-[11px] font-bold uppercase tracking-widest text-zinc-400 underline underline-offset-2 hover:text-amber-400 transition-colors cursor-pointer">{t("product.sizeGuide")}</button>
            </div>
            <div class="grid grid-cols-3 gap-1.5 sm:flex sm:flex-nowrap">
              {product.sizes.map((s) => {
                const sizeInventory = inventoryAvailability(
                  product,
                  s,
                  inventory?.status === "ready" ? inventory.variants : null,
                )
                const inStock = sizeInventory?.available ?? sizeInStock(product, s)
                if (!inStock) return (
                  <button key={s} onClick={() => requestSize(s)} title={t("product.restockTitle", s)} aria-label={t("product.restockAria", s)}
                    class="relative min-h-[44px] min-w-[44px] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-zinc-800 text-zinc-400 line-through cursor-pointer hover:border-amber-400/40 hover:text-amber-400/80 transition-colors">{s}</button>
                )
                const low = sizeInventory?.lowStock ?? sizeLowStock(product, s)
                return (
                  <button key={s} onClick={() => { setSize(size === s ? null : s); setError(false) }} title={low ? t("product.fewLeft", s) : undefined}
                    class={`relative min-h-[44px] min-w-[44px] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${size === s ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-700 text-zinc-300 hover:border-amber-400/60"}`}>
                    {s}
                    {low && <span aria-hidden="true" class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setGuideOpen(true)} class="sm:hidden mt-2 min-h-[44px] items-center text-[11px] font-bold uppercase tracking-widest text-zinc-400 underline underline-offset-2 hover:text-amber-400 transition-colors cursor-pointer">{t("product.sizeGuide")}</button>
            <div role="status" aria-live="polite">
              {error && <p class="text-[11px] uppercase tracking-widest text-red-400 mt-2">{t("product.pickSize")}</p>}
              {selectedLow && <p class="text-[11px] uppercase tracking-widest text-amber-400/90 mt-2">{t("product.fewLeft", size)}</p>}
              {notice && <p class="text-[11px] uppercase tracking-widest text-amber-400/90 mt-2">{notice}</p>}
            </div>
          </div>
        )}

        <div class="mb-3 min-h-[22px]" role="status" aria-live="polite">
          {inventory?.status === "loading" && (
            <span class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <span class="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-amber-400" aria-hidden="true" />
              {lang === "pl" ? "Sprawdzam dostępność" : "Checking availability"}
            </span>
          )}
          {inventory?.status === "ready" && inventoryState && (
            <span class={`text-[11px] font-bold uppercase tracking-widest ${inventoryState.available ? "text-zinc-400" : "text-zinc-500"}`}>
              {inventoryState.available
                ? inventoryState.lowStock
                  ? (lang === "pl" ? "Ostatnie sztuki" : "Last items")
                  : (lang === "pl" ? "Dostępny" : "Available")
                : (lang === "pl" ? "Brak w magazynie" : "Out of stock")}
            </span>
          )}
          {inventory?.status === "unavailable" && (
            <span class="text-[11px] font-bold uppercase tracking-widest text-zinc-600">
              {lang === "pl" ? "Cenę i stan potwierdzimy przy zakupie" : "Price and stock confirmed at checkout"}
            </span>
          )}
        </div>

        <div class="flex flex-col gap-3 mt-auto sm:flex-row sm:items-center sm:justify-between">
          <span class="flex items-baseline gap-2">
            {onSale && <span class="text-sm font-semibold text-zinc-400 line-through">{product.price}</span>}
            <span class={`text-lg font-black ${onSale ? "text-amber-400" : "text-zinc-100"}`}>
              {price}<span class="text-xs font-semibold text-zinc-400 ml-1">PLN</span>
            </span>
          </span>
          <button onClick={handleAdd} disabled={!available}
            class="virya-button virya-button--secondary w-full whitespace-nowrap sm:w-auto disabled:cursor-not-allowed disabled:opacity-40">
            {available ? t("product.addToCart") : t("product.soldOut")}
          </button>
        </div>
      </div>

      <p class="sr-only" role="status" aria-live="polite">{announce}</p>

      {guideOpen && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={t("product.sizeGuideTitle")} onClick={() => setGuideOpen(false)}>
          <div class="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-5" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-black uppercase tracking-widest text-zinc-100">{t("product.sizeGuideTitle")}</h3>
              <button type="button" onClick={() => setGuideOpen(false)} aria-label={t("product.closeGuide")} class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none cursor-pointer">&times;</button>
            </div>
            <table class="w-full text-left">
              <thead><tr class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-800">
                <th class="py-2">{t("product.size")}</th>
                <th class="py-2">{t("product.chest")}</th>
                <th class="py-2">{t("product.length")}</th>
              </tr></thead>
              <tbody>
                {SIZE_CHART.map((row) => (
                  <tr key={row.size} class="text-xs text-zinc-200 border-b border-zinc-800/60">
                    <td class="py-2 font-bold">{row.size}</td>
                    <td class="py-2">{row.chest}</td>
                    <td class="py-2">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="mt-4 text-xs leading-relaxed text-zinc-400">{t("product.sizeChartNote")}</p>
          </div>
        </div>
      )}

      {zoomed && zoomSrcs.length > 0 && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out" role="dialog" aria-modal="true" aria-label={name} onClick={() => { setZoomed(false); setSlide(0) }}>
          <button type="button" onClick={() => { setZoomed(false); setSlide(0) }} aria-label={t("product.closeZoom")} class="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-zinc-300 hover:text-amber-400 transition-colors text-3xl leading-none lg:border lg:border-zinc-600/50 lg:rounded">&times;</button>
          {zoomSrcs.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setSlide((s) => Math.max(0, s - 1)) }} aria-label={t("product.prevImage")} class="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 lg:h-28 lg:border lg:border-zinc-600/50 lg:rounded flex items-center justify-center text-zinc-200 hover:text-amber-400 bg-black/40 hover:bg-black/60 transition-colors text-2xl leading-none">&#8249;</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setSlide((s) => Math.min(zoomSrcs.length - 1, s + 1)) }} aria-label={t("product.nextImage")} class="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 lg:h-28 lg:border lg:border-zinc-600/50 lg:rounded flex items-center justify-center text-zinc-200 hover:text-amber-400 bg-black/40 hover:bg-black/60 transition-colors text-2xl leading-none">&#8250;</button>
            </>
          )}
          <div class="max-w-3xl w-full h-[85vh] overflow-hidden touch-none select-none" style={{ touchAction: "none" }}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div class="flex h-full w-full" style={{ transform: `translateX(calc(${-slide * 100}% + ${dragX}px))`, transition: dragging ? "none" : "transform 350ms ease-out" }}>
              {zoomSrcs.map((src, i) => (
                <div key={i} class="w-full min-w-0 flex-shrink-0 h-full flex items-center justify-center px-1">
                  <div class="w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <img src={src} alt={product.name} loading="lazy" decoding="async" width="1000" height="1000" class="w-full max-h-full object-contain" draggable={false} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {zoomSrcs.length > 1 && (
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {zoomSrcs.map((_, i) => (
                <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setSlide(i) }} aria-label={t("product.goToImage", i + 1)} aria-current={i === slide}
                  class={`w-2 h-2 rounded-full transition-colors ${i === slide ? "bg-amber-400" : "bg-zinc-600 hover:bg-zinc-400"}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProductCard
