"use client"
import React, { memo, useState } from "react"
import { GatsbyImage } from "gatsby-plugin-image"
import { useCart } from "./cartContext"

const ProductCard = memo(({ product, images }) => {
  const { add } = useCart()
  const [size, setSize] = useState(null)
  const [hovered, setHovered] = useState(false)
  const [error, setError] = useState(false)

  const front = images[product.front]
  const back = product.back ? images[product.back] : null
  const showBack = hovered && back
  const needsSize = Array.isArray(product.sizes)

  const handleAdd = () => {
    if (needsSize && !size) {
      setError(true)
      return
    }
    setError(false)
    add(product.id, size, 1)
  }

  return (
    <div className="group flex flex-col bg-zinc-900/40 border border-zinc-800/60 hover:border-amber-400/40 transition-colors duration-300">
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
            }`}
          />
        )}
        {back && (
          <GatsbyImage
            image={back}
            alt={`${product.name} — back`}
            loading="lazy"
            className={`!absolute inset-0 block w-full transition-opacity duration-500 ${
              showBack ? "opacity-100" : "opacity-0"
            }`}
          />
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
              {product.sizes.map(s => (
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
              ))}
            </div>
            {error && (
              <p className="text-[10px] uppercase tracking-widest text-red-400 mt-2">
                Pick a size first
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-auto">
          <span className="text-lg font-black text-zinc-100">
            {product.price}
            <span className="text-xs font-semibold text-zinc-500 ml-1">
              PLN
            </span>
          </span>
          <button
            onClick={handleAdd}
            className="text-[11px] font-bold uppercase tracking-widest px-4 py-2 border border-amber-400/60 text-amber-400 hover:bg-amber-400 hover:text-black transition-all duration-200"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  )
})

export default ProductCard
