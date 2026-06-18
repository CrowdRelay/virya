"use client"
import React, { memo, useState, useEffect, useRef, useCallback } from "react"
import { GatsbyImage } from "gatsby-plugin-image"
import { useCart } from "./cartContext"
import { useI18n } from "../../i18n/I18nContext"
import {
  discountedPrice,
  sizeInStock,
  productInStock,
  productLowStock,
  sizeLowStock,
  isBundle,
  discountActive,
  discountPct,
} from "../../data/products"

const ProductCard = memo(({ product, images, index = 0 }) => {
  const { add } = useCart()
  const { t, lang } = useI18n()
  const [size, setSize] = useState(null)
  const [hovered, setHovered] = useState(false)
  const [error, setError] = useState(false)
  const [requested, setRequested] = useState([])
  const [notice, setNotice] = useState("")
  const [announce, setAnnounce] = useState("")
  const [zoomed, setZoomed] = useState(false)
  const [slide, setSlide] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = useCallback(e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(e => {
    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const dx = touchEndX - touchStartX.current
    const dy = Math.abs(touchEndY - touchStartY.current)

    // Only trigger if horizontal swipe is dominant and significant
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy) {
      if (dx > 0) {
        // Swipe right - previous image
        setSlide(s => (s - 1 + zoomImages.length) % zoomImages.length)
      } else {
        // Swipe left - next image
        setSlide(s => (s + 1) % zoomImages.length)
      }
    }
  }, [zoomImages.length])

  const front = images[product.front]
  const back = product.back ? images[product.back] : null
  const showBack = hovered && back
  const needsSize = Array.isArray(product.sizes)
  const available = productInStock(product)
  const price = discountedPrice(product)
  const onSale = discountActive() && price < product.price
  const bundle = isBundle(product)
  const lowStock = productLowStock(product)
  const selectedLow = needsSize && size && sizeLowStock(product, size)
  const blurb = lang === "pl" && product.blurb_pl ? product.blurb_pl : product.blurb
  const includes =
    lang === "pl" && product.includes_pl
      ? product.includes_pl
      : product.includes
  const name = lang === "pl" && product.name_pl ? product.name_pl : product.name

  // Bundles and products with back images enlarge into a 2-image carousel.
  const zoomImages = (bundle || back ? [front, back] : [front]).filter(Boolean)

  const openZoom = () => {
    setSlide(0)
    setZoomed(true)
  }

  const handleAdd = () => {
    if (!available) return
    if (needsSize && !size) {
      setError(true)
      return
    }
    setError(false)
    add(product.id, size, 1)
    // Screen readers don't perceive the cart drawer opening; announce it.
    setAnnounce(t("product.added", name))
  }

  // Clear the live-region message so re-adding the same item announces again.
  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(""), 1000)
    return () => clearTimeout(id)
  }, [announce])

  // Close the zoom lightbox on Escape, navigate the carousel with arrows,
  // and lock body scroll while it's open.
  useEffect(() => {
    if (!zoomed) return
    const onKey = e => {
      if (e.key === "Escape") setZoomed(false)
      if (zoomImages.length > 1) {
        if (e.key === "ArrowRight") setSlide(s => (s + 1) % zoomImages.length)
        if (e.key === "ArrowLeft") setSlide(s => (s - 1 + zoomImages.length) % zoomImages.length)
      }
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [zoomed, zoomImages.length])

  const requestSize = async s => {
    if (requested.includes(s)) return
    setRequested(prev => [...prev, s])
    setNotice(t("product.restock", s))
    try {
      await fetch("/api/size-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, size: s }),
      })
    } catch {
      /* best-effort notification — fail silently */
    }
  }

  return (
    <div
      className={`group flex flex-col bg-zinc-900/40 border border-zinc-800/60 hover:border-amber-400/40 transition-colors duration-300 ${
        available ? "" : "opacity-60"
      }`}
    >
      <div
        className="relative overflow-hidden bg-zinc-950"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {front && (
          <GatsbyImage
            image={front}
            alt={product.name}
            title={product.name}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            className={`block w-full transition-opacity duration-500 ${
              showBack ? "opacity-0" : "opacity-100"
            } ${available ? "" : "grayscale"}`}
          />
        )}
        {back && (
          <GatsbyImage
            image={back}
            alt={`${product.name} — back`}
            loading="lazy"
            className={`!absolute inset-0 block w-full transition-opacity duration-500 ${
              showBack ? "opacity-100" : "opacity-0"
            } ${available ? "" : "grayscale"}`}
          />
        )}
        {front && (
          <button
            type="button"
            onClick={openZoom}
            aria-label={t("product.zoomAria", name)}
            className="absolute inset-0 z-10 cursor-zoom-in"
          />
        )}
        {/* Top-left badge stack */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {bundle && (
            <span className="text-[10px] font-black uppercase tracking-widest text-black bg-zinc-100 px-2 py-1">
              {t("product.bundle")}
            </span>
          )}
          {onSale && (
            <span className="text-[10px] font-black uppercase tracking-widest text-black bg-amber-400 px-2 py-1">
              −{discountPct(product)}%
            </span>
          )}
        </div>
        {/* Low-stock nudge */}
        {available && lowStock && (
          <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-black/70 px-2 py-1 backdrop-blur-sm">
            {t("product.lowStock")}
          </span>
        )}
        {!available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-black uppercase tracking-widest text-zinc-200">
            {t("product.soldOut")}
          </span>
        )}
        {back && (
          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-zinc-300 bg-black/60 px-2 py-1 backdrop-blur-sm">
            {t("product.hoverBack")}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <h2 className="text-sm lg:text-base font-black uppercase tracking-wide leading-tight text-zinc-100">
          {name}
        </h2>
        <p
          className={`text-xs text-zinc-400 leading-snug mt-1 ${
            bundle ? "mb-3" : "mb-4 flex-1"
          }`}
        >
          {blurb}
        </p>

        {bundle && Array.isArray(includes) && (
          <ul className="mb-4 flex-1 space-y-1">
            {includes.map(inc => (
              <li
                key={inc}
                className="flex items-center gap-2 text-[11px] text-zinc-300"
              >
                <span className="text-amber-400" aria-hidden="true">
                  +
                </span>
                {inc}
              </li>
            ))}
          </ul>
        )}

        {needsSize && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              {t("product.size")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map(s => {
                const inStock = sizeInStock(product, s)
                if (!inStock) {
                  return (
                    <button
                      key={s}
                      onClick={() => requestSize(s)}
                      title={t("product.restockTitle", s)}
                      aria-label={t("product.restockAria", s)}
                      className="relative min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-zinc-800 text-zinc-400 line-through cursor-pointer hover:border-amber-400/40 hover:text-amber-400/80 transition-colors"
                    >
                      {s}
                    </button>
                  )
                }
                const low = sizeLowStock(product, s)
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSize(s)
                      setError(false)
                    }}
                    title={low ? t("product.fewLeft", s) : undefined}
                    className={`relative min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                      size === s
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-zinc-700 text-zinc-300 hover:border-amber-400/60"
                    }`}
                  >
                    {s}
                    {low && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400"
                      />
                    )}
                  </button>
                )
              })}
            </div>
            <div role="status" aria-live="polite">
              {error && (
                <p className="text-[10px] uppercase tracking-widest text-red-400 mt-2">
                  {t("product.pickSize")}
                </p>
              )}
              {selectedLow && (
                <p className="text-[10px] uppercase tracking-widest text-amber-400/90 mt-2">
                  {t("product.fewLeft", size)}
                </p>
              )}
              {notice && (
                <p className="text-[10px] uppercase tracking-widest text-amber-400/90 mt-2">
                  {notice}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-auto">
          <span className="flex items-baseline gap-2">
            {onSale && (
              <span className="text-sm font-semibold text-zinc-400 line-through">
                {product.price}
              </span>
            )}
            <span
              className={`text-lg font-black ${
                onSale ? "text-amber-400" : "text-zinc-100"
              }`}
            >
              {price}
              <span className="text-xs font-semibold text-zinc-400 ml-1">
                PLN
              </span>
            </span>
          </span>
          <button
            onClick={handleAdd}
            disabled={!available}
            className="text-[11px] font-bold uppercase tracking-widest px-4 py-2 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-amber-400 transition-all duration-200"
          >
            {available ? t("product.addToCart") : t("product.soldOut")}
          </button>
        </div>
      </div>

      {/* Polite announcement for screen readers when an item is added. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {/* Click-to-enlarge lightbox. Bundles get a 2-image carousel. */}
      {zoomed && zoomImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label={name}
          onClick={() => setZoomed(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label={t("product.closeZoom")}
            className="absolute top-4 right-4 z-10 text-zinc-300 hover:text-amber-400 transition-colors text-3xl leading-none"
          >
            &times;
          </button>

          {zoomImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setSlide(s => (s - 1 + zoomImages.length) % zoomImages.length)
                }}
                aria-label={t("product.prevImage")}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-zinc-200 hover:text-amber-400 bg-black/40 hover:bg-black/60 transition-colors text-2xl leading-none"
              >
                &#8249;
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setSlide(s => (s + 1) % zoomImages.length)
                }}
                aria-label={t("product.nextImage")}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-zinc-200 hover:text-amber-400 bg-black/40 hover:bg-black/60 transition-colors text-2xl leading-none"
              >
                &#8250;
              </button>
            </>
          )}

          <div
            className="max-w-3xl w-full max-h-[85vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <GatsbyImage
              image={zoomImages[slide]}
              alt={product.name}
              className="w-full h-full"
              objectFit="contain"
            />
          </div>

          {zoomImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {zoomImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setSlide(i)
                  }}
                  aria-label={t("product.goToImage", i + 1)}
                  aria-current={i === slide}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === slide ? "bg-amber-400" : "bg-zinc-600 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default ProductCard
