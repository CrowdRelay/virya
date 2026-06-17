"use client"
import React, { useState, useCallback, useRef } from "react"
import { Link } from "gatsby"
import { GatsbyImage } from "gatsby-plugin-image"
import { useCart, lineKey } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import InpostGeowidget from "./inpostGeowidget"

const inputClass =
  "bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 transition-colors"

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
  const {
    lines,
    open,
    setOpen,
    subtotal,
    shipping,
    needsShipping,
    total,
    setQty,
    remove,
  } = useCart()
  const images = useMerchImages()
  const [point, setPoint] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = useCallback(e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
    setDragX(0)
  }, [])

  const handleTouchMove = useCallback(e => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > 0 && dx > dy) setDragX(dx)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (dragX > 80) setOpen(false)
    setDragX(0)
  }, [dragX, setOpen])
  const [invoice, setInvoice] = useState({
    name: "",
    surname: "",
    email: "",
    address: "",
    nip: "",
    company: "",
  })

  const setField = useCallback(
    field => e => {
      const { value } = e.target
      setInvoice(prev => ({ ...prev, [field]: value }))
    },
    []
  )

  const checkout = useCallback(async () => {
    setError("")
    const name = invoice.name.trim()
    const surname = invoice.surname.trim()
    const email = invoice.email.trim()
    const address = invoice.address.trim()
    if (!name || !surname || !email || !address) {
      setError("Fill in your name, surname, address and email.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.")
      return
    }
    if (needsShipping && !point) {
      setError("Choose a Paczkomat for delivery first.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map(l => ({ id: l.id, size: l.size, qty: l.qty })),
          point: needsShipping ? point : null,
          invoice: {
            name,
            surname,
            email,
            address,
            nip: invoice.nip.trim(),
            company: invoice.company.trim(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed")
      window.location.href = data.url
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.")
      setLoading(false)
    }
  }, [lines, point, needsShipping, invoice])

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
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col ${isDragging ? "" : "transition-transform duration-300"} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={dragX > 0 ? { transform: `translateX(${dragX}px)` } : undefined}
        aria-label="Shopping cart"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
            {needsShipping && (
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
            )}

            {/* Invoice / buyer details */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Billing details · for your invoice
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={invoice.name}
                  onChange={setField("name")}
                  placeholder="First name *"
                  autoComplete="given-name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={invoice.surname}
                  onChange={setField("surname")}
                  placeholder="Surname *"
                  autoComplete="family-name"
                  className={inputClass}
                />
              </div>
              <input
                type="email"
                value={invoice.email}
                onChange={setField("email")}
                placeholder="Email *"
                autoComplete="email"
                className={`${inputClass} mt-2 w-full`}
              />
              <input
                type="text"
                value={invoice.address}
                onChange={setField("address")}
                placeholder="Address (street, postcode, city) *"
                autoComplete="street-address"
                className={`${inputClass} mt-2 w-full`}
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  value={invoice.company}
                  onChange={setField("company")}
                  placeholder="Company (optional)"
                  autoComplete="organization"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={invoice.nip}
                  onChange={setField("nip")}
                  placeholder="NIP (optional, B2B)"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span className="text-xs uppercase tracking-widest">
                  Subtotal
                </span>
                <span>{subtotal} PLN</span>
              </div>
              {needsShipping && (
                <div className="flex justify-between text-zinc-400">
                  <span className="text-xs uppercase tracking-widest">
                    Delivery
                  </span>
                  <span>{shipping} PLN</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-100 font-black pt-2 border-t border-zinc-800 mt-2">
                <span className="text-xs uppercase tracking-widest">Total</span>
                <span>{total} PLN</span>
              </div>
              <p className="text-[10px] text-zinc-600 pt-1">
                Goods include 23% VAT · delivery exempt
              </p>
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
              BLIK · Google Pay · Revolut Pay · Card
            </p>
            <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
              By paying you agree to our{" "}
              <Link
                to="/legal/terms"
                className="underline underline-offset-2 hover:text-amber-400"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                to="/legal/returns"
                className="underline underline-offset-2 hover:text-amber-400"
              >
                Returns policy
              </Link>
              .
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
