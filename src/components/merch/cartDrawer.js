"use client"
import React, { useState, useCallback } from "react"
import { GatsbyImage } from "gatsby-plugin-image"
import { useCart, lineKey } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import InpostGeowidget from "./inpostGeowidget"

const QtyButton = ({ children, onClick, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="w-7 h-7 flex items-center justify-center border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors text-sm leading-none"
  >
    {children}
  </button>
)

const CartDrawer = () => {
  const { lines, open, setOpen, subtotal, shipping, total, setQty, remove } =
    useCart()
  const images = useMerchImages()
  const [point, setPoint] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const checkout = useCallback(async () => {
    setError("")
    if (!point) {
      setError("Choose a Paczkomat for delivery first.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map(l => ({ id: l.id, size: l.size, qty: l.qty })),
          point,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed")
      window.location.href = data.url
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.")
      setLoading(false)
    }
  }, [lines, point])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-100">
            Your cart
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="text-zinc-500 hover:text-amber-400 transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="text-sm text-zinc-500 uppercase tracking-widest text-center mt-12">
              Your cart is empty
            </p>
          ) : (
            <ul className="space-y-4">
              {lines.map(l => {
                const img = images[l.product.front]
                const key = lineKey(l.id, l.size)
                return (
                  <li
                    key={key}
                    className="flex gap-3 border-b border-zinc-800/60 pb-4"
                  >
                    <div className="w-16 h-16 flex-shrink-0 bg-zinc-900 overflow-hidden">
                      {img && (
                        <GatsbyImage
                          image={img}
                          alt={l.product.name}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-100 leading-tight">
                        {l.product.name}
                      </p>
                      {l.size && (
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                          Size {l.size}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <QtyButton
                            label="Decrease quantity"
                            onClick={() => setQty(l.id, l.size, l.qty - 1)}
                          >
                            &minus;
                          </QtyButton>
                          <span className="text-sm text-zinc-200 w-5 text-center">
                            {l.qty}
                          </span>
                          <QtyButton
                            label="Increase quantity"
                            onClick={() => setQty(l.id, l.size, l.qty + 1)}
                          >
                            +
                          </QtyButton>
                        </div>
                        <span className="text-sm font-bold text-zinc-100">
                          {l.lineTotal} PLN
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(l.id, l.size)}
                      aria-label="Remove item"
                      className="self-start text-zinc-600 hover:text-red-400 transition-colors text-xs"
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {lines.length > 0 && (
            <p className="mt-5 text-[11px] uppercase tracking-widest text-amber-400/90 border border-amber-400/30 px-3 py-2">
              + Free stickers with every order
            </p>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
            {/* Delivery */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                InPost Paczkomat delivery
              </p>
              {point ? (
                <div className="flex items-start justify-between gap-3 border border-zinc-800 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-400">
                      {point.code}
                    </p>
                    {point.address && (
                      <p className="text-[11px] text-zinc-400 truncate">
                        {point.address}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-amber-400 whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-full text-xs font-bold uppercase tracking-widest py-2.5 border border-zinc-700 text-zinc-200 hover:border-amber-400 hover:text-amber-400 transition-colors"
                >
                  Choose Paczkomat
                </button>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span className="text-xs uppercase tracking-widest">
                  Subtotal
                </span>
                <span>{subtotal} PLN</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="text-xs uppercase tracking-widest">
                  Delivery
                </span>
                <span>{shipping} PLN</span>
              </div>
              <div className="flex justify-between text-zinc-100 font-black pt-2 border-t border-zinc-800 mt-2">
                <span className="text-xs uppercase tracking-widest">Total</span>
                <span>{total} PLN</span>
              </div>
            </div>

            {error && (
              <p className="text-[11px] uppercase tracking-widest text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={checkout}
              disabled={loading}
              className="w-full bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-widest font-bold text-sm py-3 transition-all duration-200"
            >
              {loading ? "Redirecting…" : "Pay with Stripe"}
            </button>
            <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">
              BLIK · Google Pay · Przelewy24 · Card
            </p>
          </div>
        )}
      </aside>

      <InpostGeowidget
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setPoint}
      />
    </>
  )
}

export default CartDrawer
