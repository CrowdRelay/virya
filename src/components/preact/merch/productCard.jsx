import { useState, useEffect, useRef, useCallback } from "preact/hooks"
import { useCartActions } from "./cartContext"
import { useI18n } from "../../../i18n/I18nContext"
import {
  discountedPrice,
  sizeInStock,
  productInStock,
  productLowStock,
  sizeLowStock,
  isBundle,
  discountActive,
  discountPct,
  SIZE_CHART,
} from "../../../data/products"

const ProductCard = ({ product, images, index = 0 }) => {
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
  const [playing, setPlaying] = useState(false)
  const [isWide, setIsWide] = useState(true)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [slide, setSlide] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [autoImageIndex, setAutoImageIndex] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)
  const dragXRef = useRef(0)

  const frontSrc = images[product.front]
  const backSrc = product.back ? images[product.back] : null
  const bundle = isBundle(product)
  const showBack = bundle ? autoImageIndex === 1 : hovered && backSrc
  const needsSize = Array.isArray(product.sizes)
  const available = productInStock(product)
  const price = discountedPrice(product)
  const onSale = discountActive() && price < product.price
  const lowStock = productLowStock(product)
  const selectedLow = needsSize && size && sizeLowStock(product, size)
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
    if (!guideOpen && !zoomed && !(playing && !isWide)) return
    const onKey = (e) => {
      if (e.key === "Escape") { setGuideOpen(false); setZoomed(false); setPlaying(false) }
      if (zoomed && zoomSrcs.length > 1) {
        if (e.key === "ArrowRight") setSlide((s) => (s + 1) % zoomSrcs.length)
        if (e.key === "ArrowLeft") setSlide((s) => (s - 1 + zoomSrcs.length) % zoomSrcs.length)
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [guideOpen, zoomed, playing, isWide, zoomSrcs.length])

  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(""), 1000)
    return () => clearTimeout(id)
  }, [announce])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => setIsWide(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Auto-cycle images for bundles every 7 seconds
  useEffect(() => {
    if (!bundle || !backSrc) return
    const interval = setInterval(() => {
      setAutoImageIndex((prev) => (prev + 1) % 2)
    }, 7000)
    return () => clearInterval(interval)
  }, [bundle, backSrc])

  const requestSize = async (s) => {
    if (requested.includes(s)) return
    setRequested((prev) => [...prev, s])
    setNotice(t("product.restock", s))
    try {
      await fetch("/api/size-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, size: s }),
      })
    } catch {}
  }

  const imgClass = (hidden) =>
    `block w-full h-auto transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"} ${available ? "" : "grayscale"}`

  return (
    <div class={`group flex flex-col bg-zinc-900/40 border border-zinc-800/60 hover:border-amber-400/40 transition-colors duration-300 ${available ? "" : "opacity-60"}`}>
      <div
        class="relative overflow-hidden bg-zinc-950"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {frontSrc && (
          <img
            src={frontSrc}
            alt={product.name}
            loading={index === 0 ? "eager" : "lazy"}
            fetchpriority={index === 0 ? "high" : undefined}
            decoding="async"
            width="400"
            height="400"
            class={imgClass(showBack)}
          />
        )}
        {backSrc && (
          <img
            src={backSrc}
            alt={`${product.name} — back`}
            loading="lazy"
            decoding="async"
            width="400"
            height="400"
            class={`absolute inset-0 ${imgClass(!showBack)}`}
          />
        )}
        {frontSrc && (
          <button type="button" onClick={() => { setSlide(0); setZoomed(true) }} aria-label={t("product.zoomAria", name)} class="absolute inset-0 z-10 cursor-zoom-in" />
        )}
        <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
          {bundle && <span class="text-[10px] font-black uppercase tracking-widest text-black bg-zinc-100 px-2 py-1">{t("product.bundle")}</span>}
          {onSale && <span class="text-[10px] font-black uppercase tracking-widest text-black bg-amber-400 px-2 py-1">−{discountPct(product)}%</span>}
        </div>
        {available && lowStock && (
          <span class="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-black/70 px-2 py-1 backdrop-blur-sm">{t("product.lowStock")}</span>
        )}
        {!available && (
          <span class="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-black uppercase tracking-widest text-zinc-200">{t("product.soldOut")}</span>
        )}
        {backSrc && (
          <span class="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-zinc-300 bg-black/60 px-2 py-1 backdrop-blur-sm">{t("product.hoverBack")}</span>
        )}
      </div>

      <div class="flex flex-col flex-1 p-4">
        <h2 class="text-sm lg:text-base font-black uppercase tracking-wide leading-tight text-zinc-100">{name}</h2>
        <p class={`text-xs text-zinc-400 leading-snug mt-1 text-justify ${bundle || product.spotifyId ? "mb-3" : "mb-4 flex-1"}`}>{blurb}</p>

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
          <div class="mb-4">
            <button type="button" onClick={() => { setPlaying((p) => !p); if (playing) setIframeLoaded(false) }} aria-expanded={playing}
              class="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5">
                {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
              </svg>
              {playing ? t("product.hidePreview") : t("product.listen")}
            </button>
            {playing && isWide && (
              <div class="mt-3 relative h-[152px]">
                {!iframeLoaded && (
                  <div class="absolute inset-0 w-full h-full bg-zinc-900/30 p-2 flex flex-col gap-1.5 rounded-2xl">
                    <div class="flex items-center gap-2 pb-1.5 border-b border-zinc-800/40">
                      <div class="w-7 h-7 bg-zinc-700/50 animate-pulse flex-shrink-0" />
                      <div class="flex-1 flex flex-col gap-0.5">
                        <div class="h-1.5 w-1/3 bg-zinc-700/50 animate-pulse" />
                        <div class="h-1 w-1/4 bg-zinc-800/50 animate-pulse" />
                      </div>
                    </div>
                    {[75, 65, 55].map((w) => (
                      <div class="flex items-center gap-2">
                        <div class="w-5 h-5 bg-zinc-700/50 animate-pulse flex-shrink-0" />
                        <div class="flex-1 flex flex-col gap-0.5">
                          <div class="h-1.5 bg-zinc-700/50 animate-pulse" style={`width:${w}%`} />
                          <div class="h-1 w-1/4 bg-zinc-800/50 animate-pulse" />
                        </div>
                        <div class="h-1 w-4 bg-zinc-800/50 animate-pulse flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
                <iframe title={t("product.previewTitle", name)} src={`https://open.spotify.com/embed/album/${product.spotifyId}?utm_source=generator&theme=0`}
                  width="100%" height="152" frameBorder="0" loading="lazy"
                  allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture" 
                  class={`absolute inset-0 w-full h-full rounded-2xl ${iframeLoaded ? '' : 'opacity-0'}`}
                  onLoad={() => setIframeLoaded(true)} />
              </div>
            )}
          </div>
        )}

        {needsSize && (
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("product.size")}</p>
              <button type="button" onClick={() => setGuideOpen(true)} class="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-zinc-400 underline underline-offset-2 hover:text-amber-400 transition-colors">{t("product.sizeGuide")}</button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              {product.sizes.map((s) => {
                const inStock = sizeInStock(product, s)
                if (!inStock) return (
                  <button key={s} onClick={() => requestSize(s)} title={t("product.restockTitle", s)} aria-label={t("product.restockAria", s)}
                    class="relative min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-zinc-800 text-zinc-400 line-through cursor-pointer hover:border-amber-400/40 hover:text-amber-400/80 transition-colors">{s}</button>
                )
                const low = sizeLowStock(product, s)
                return (
                  <button key={s} onClick={() => { setSize(s); setError(false) }} title={low ? t("product.fewLeft", s) : undefined}
                    class={`relative min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors ${size === s ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-700 text-zinc-300 hover:border-amber-400/60"}`}>
                    {s}
                    {low && <span aria-hidden="true" class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setGuideOpen(true)} class="sm:hidden mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 underline underline-offset-2 hover:text-amber-400 transition-colors">{t("product.sizeGuide")}</button>
            <div role="status" aria-live="polite">
              {error && <p class="text-[10px] uppercase tracking-widest text-red-400 mt-2">{t("product.pickSize")}</p>}
              {selectedLow && <p class="text-[10px] uppercase tracking-widest text-amber-400/90 mt-2">{t("product.fewLeft", size)}</p>}
              {notice && <p class="text-[10px] uppercase tracking-widest text-amber-400/90 mt-2">{notice}</p>}
            </div>
          </div>
        )}

        <div class="flex flex-col gap-3 mt-auto sm:flex-row sm:items-center sm:justify-between">
          <span class="flex items-baseline gap-2">
            {onSale && <span class="text-sm font-semibold text-zinc-400 line-through">{product.price}</span>}
            <span class={`text-lg font-black ${onSale ? "text-amber-400" : "text-zinc-100"}`}>
              {price}<span class="text-xs font-semibold text-zinc-400 ml-1">PLN</span>
            </span>
          </span>
          <button onClick={handleAdd} disabled={!available}
            class="w-full sm:w-auto text-center whitespace-nowrap text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-amber-400 transition-all duration-200">
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
              <button type="button" onClick={() => setGuideOpen(false)} aria-label={t("product.closeGuide")} class="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none">&times;</button>
            </div>
            <table class="w-full text-left">
              <thead><tr class="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-800">
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
            <p class="text-[10px] text-zinc-400 leading-relaxed mt-4 text-justify">{t("product.sizeChartNote")}</p>
          </div>
        </div>
      )}

      {playing && !isWide && product.spotifyId && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" onClick={() => setPlaying(false)}>
          <div class="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-black uppercase tracking-widest text-zinc-100">{name}</h3>
              <button type="button" onClick={() => setPlaying(false)} aria-label={t("product.hidePreview")} class="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none">&times;</button>
            </div>
            <div class="relative">
              {!iframeLoaded && (
                <div class="w-full h-[352px] bg-zinc-900 p-4 flex flex-col gap-3 rounded-2xl">
                  <div class="flex items-center gap-3 pb-3 border-b border-zinc-800/40">
                    <div class="w-12 h-12 bg-zinc-700/50 animate-pulse flex-shrink-0" />
                    <div class="flex-1 flex flex-col gap-2">
                      <div class="h-3 w-1/3 bg-zinc-700/50 animate-pulse" />
                      <div class="h-2 w-1/4 bg-zinc-800/50 animate-pulse" />
                    </div>
                  </div>
                  {[65, 55, 70, 50, 60].map((w) => (
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-zinc-700/50 animate-pulse flex-shrink-0" />
                      <div class="flex-1 flex flex-col gap-1.5">
                        <div class="h-3 bg-zinc-700/50 animate-pulse" style={`width:${w}%`} />
                        <div class="h-2 w-1/4 bg-zinc-800/50 animate-pulse" />
                      </div>
                      <div class="h-2 w-7 bg-zinc-800/50 animate-pulse flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              <iframe title={t("product.previewTitle", name)} src={`https://open.spotify.com/embed/album/${product.spotifyId}?utm_source=generator&theme=0`}
                width="100%" height="352" frameBorder="0" loading="lazy"
                allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture" 
                class={`block w-full rounded-2xl ${iframeLoaded ? '' : 'absolute inset-0 opacity-0'}`}
                onLoad={() => setIframeLoaded(true)} />
            </div>
          </div>
        </div>
      )}

      {zoomed && zoomSrcs.length > 0 && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out" role="dialog" aria-modal="true" aria-label={name} onClick={() => setZoomed(false)}>
          <button type="button" onClick={() => setZoomed(false)} aria-label={t("product.closeZoom")} class="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-zinc-300 hover:text-amber-400 transition-colors text-3xl leading-none lg:border lg:border-zinc-600/50 lg:rounded">&times;</button>
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
                    <img src={src} alt={product.name} loading="lazy" decoding="async" class="w-full max-h-full object-contain" draggable={false} />
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
