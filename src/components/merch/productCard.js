"use client"
import React, { memo, useState } from "react"
import { GatsbyImage } from "gatsby-plugin-image"
import { useCart } from "./cartContext"
import {
  discountedPrice,
  sizeInStock,
  productInStock,
  discountActive,
  DISCOUNT_RATE,
} from "../../data/products"

const DISCOUNT_PCT = Math.round(DISCOUNT_RATE * 100)

const ProductCard = memo(({ product, images }) => {
  const { add } = useCart()
  const [size, setSize] = useState(null)
  const [hovered, setHovered] = useState(false)
  const [error, setError] = useState(false)
  const [requested, setRequested] = useState([])
  const [notice, setNotice] = useState("")

  const front = images[product.front]
  const back = product.back ? images[product.back] : null
  const showBack = hovered && back
  const needsSize = Array.isArray(product.sizes)
  const available = productInStock(product)
  const price = discountedPrice(product)
  const onSale = discountActive() && price < product.price

  const handleAdd = () => {
    if (!available) return
    if (needsSize && !size) {
      setError(true)
      return
    }
    setError(false)
    add(product.id, size, 1)
  }

  const requestSize = async s => {
    if (requested.includes(s)) return
    setRequested(prev => [...prev, s])
    setNotice(`Noted — we'll let the crew know about ${s}.`)
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
            loading="lazy"
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
        {/* Discount badge */}
        {onSale && (
          <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest text-black bg-amber-400 px-2 py-1">
            −{DISCOUNT_PCT}%
          </span>
        )}
        {!available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-black uppercase tracking-widest text-zinc-200">
            Sold out
          </span>
        )}
        {back && (
          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-zinc-300 bg-black/60 px-2 py-1 backdrop-blur-sm">
            Hover · back
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <h2 className="text-sm lg:text-base font-black uppercase tracking-wide leading-tight text-zinc-100">
          {product.name}
        </h2>
        <p className="text-xs text-zinc-400 leading-snug mt-1 mb-4 flex-1">
          {product.blurb}
        </p>

        {needsSize && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map(s => {
                const inStock = sizeInStock(product, s)
                if (!inStock) {
                  return (
                    <button
                      key={s}
                      onClick={() => requestSize(s)}
                      title={`${s} is sold out — tap to request a restock`}
                      aria-label={`${s} sold out, request restock`}
                      className="relative min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-zinc-800 text-zinc-600 line-through cursor-pointer hover:border-amber-400/40 hover:text-amber-400/60 transition-colors"
                    >
                      {s}
                    </button>
                  )
                }
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSize(s)
                      setError(false)
                    }}
                    className={`min-w-[2.25rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                      size === s
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-zinc-700 text-zinc-300 hover:border-amber-400/60"
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            {error && (
              <p className="text-[10px] uppercase tracking-widest text-red-400 mt-2">
                Pick a size first
              </p>
            )}
            {notice && (
              <p className="text-[10px] uppercase tracking-widest text-amber-400/90 mt-2">
                {notice}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-auto">
          <span className="flex items-baseline gap-2">
            {onSale && (
              <span className="text-sm font-semibold text-zinc-600 line-through">
                {product.price}
              </span>
            )}
            <span
              className={`text-lg font-black ${
                onSale ? "text-amber-400" : "text-zinc-100"
              }`}
            >
              {price}
              <span className="text-xs font-semibold text-zinc-500 ml-1">
                PLN
              </span>
            </span>
          </span>
          <button
            onClick={handleAdd}
            disabled={!available}
            className="text-[11px] font-bold uppercase tracking-widest px-4 py-2 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-amber-400 transition-all duration-200"
          >
            {available ? "Add to cart" : "Sold out"}
          </button>
        </div>
      </div>
    </div>
  )
})

export default ProductCard
