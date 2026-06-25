import { useState, useCallback, useRef, useEffect } from "preact/hooks"
import { useCart, lineKey } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import { useI18n } from "../../../i18n/I18nContext"
import InpostGeowidget from "./inpostGeowidget"

const inputClass =
  "bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors"

const QtyButton = ({ children, onClick, label }) => (
  <button onClick={onClick} aria-label={label}
    class="w-7 h-7 flex items-center justify-center border border-zinc-700 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors text-sm leading-[1] cursor-pointer">
    {children === "+" ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" stroke-linecap="round" class="w-4 h-4">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ) : children === "−" || children === "−" || children === "&minus;" ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" stroke-linecap="round" class="w-4 h-4">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ) : (
      children
    )}
  </button>
)

const CartDrawer = () => {
  const { t, lang, lp } = useI18n()
  const getProductName = (product) => lang === "pl" && product.name_pl ? product.name_pl : product.name
  const { lines, open, setOpen, subtotal, shipping, needsShipping, total, setQty, remove } = useCart()
  const images = useMerchImages()
  const [point, setPoint] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [invoice, setInvoice] = useState({ name: "", surname: "", email: "", address: "", nip: "", company: "" })

  useEffect(() => {
    if (!open) return
    const { body } = document
    const root = document.documentElement
    const vv = window.visualViewport
    const scrollY = window.scrollY
    const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width }
    body.style.cssText += ";position:fixed;top:-" + scrollY + "px;left:0;right:0;width:100%"
    const setH = () => root.style.setProperty("--cart-h", `${vv ? vv.height : window.innerHeight}px`)
    setH()
    vv?.addEventListener("resize", setH)
    window.addEventListener("resize", setH)
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
      vv?.removeEventListener("resize", setH)
      window.removeEventListener("resize", setH)
      root.style.removeProperty("--cart-h")
    }
  }, [open])

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
    setDragX(0)
  }, [])
  const handleTouchMove = useCallback((e) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > 0 && dx > dy) setDragX(dx)
  }, [])
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (dragX > 80) setOpen(false)
    setDragX(0)
  }, [dragX, setOpen])

  const setField = useCallback((field) => (e) => setInvoice((prev) => ({ ...prev, [field]: e.target.value })), [])

  const checkout = useCallback(async () => {
    setError("")
    const name = invoice.name.trim(); const surname = invoice.surname.trim()
    const email = invoice.email.trim(); const address = invoice.address.trim()
    if (!name || !surname || !email || !address) { setError(t("cart.errFill")); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t("cart.errEmail")); return }
    if (needsShipping && !point) { setError(t("cart.errPaczkomat")); return }
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, items: lines.map((l) => ({ id: l.id, size: l.size, qty: l.qty })), point: needsShipping ? point : null, invoice: { name, surname, email, address, nip: invoice.nip.trim(), company: invoice.company.trim() } }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed")
      window.location.href = data.url
    } catch (e) { setError(e.message || t("cart.errGeneric")); setLoading(false) }
  }, [lines, point, needsShipping, invoice, t, lang])

  return (
    <>
      <div class={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        class={`fixed top-0 right-0 z-40 h-[var(--cart-h,100dvh)] w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col ${isDragging ? "" : "transition-transform duration-300"} ${open ? "translate-x-0" : "translate-x-full"}`}
        style={dragX > 0 ? { transform: `translateX(${dragX}px)` } : undefined}
        aria-label={t("cart.title")}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 class="text-sm font-black uppercase tracking-widest text-zinc-100">{t("cart.title")}</h2>
          <button onClick={() => setOpen(false)} aria-label={t("cart.close")} class="text-zinc-500 hover:text-amber-400 transition-colors text-2xl leading-none cursor-pointer">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <p class="text-sm text-zinc-400 uppercase tracking-widest text-center mt-12">{t("cart.empty")}</p>
          ) : (
            <ul class="space-y-4">
              {lines.map((l) => {
                const img = images[l.product.front]
                const key = lineKey(l.id, l.size)
                return (
                  <li key={key} class="flex gap-3 border-b border-zinc-800/60 pb-4">
                    <div class="w-16 h-16 flex-shrink-0 bg-zinc-900 overflow-hidden">
                      {img && <img src={img} alt={getProductName(l.product)} loading="lazy" width="64" height="64" class="w-full h-full object-cover" />}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold uppercase tracking-wide text-zinc-100 leading-tight">{getProductName(l.product)}</p>
                      {l.size && <p class="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">{t("cart.sizeLabel", l.size)}</p>}
                      <div class="flex items-center justify-between mt-2">
                        <div class="flex items-center gap-2">
                          <QtyButton label={t("cart.decrease")} onClick={() => setQty(l.id, l.size, l.qty - 1)}>&minus;</QtyButton>
                          <span class="text-sm text-zinc-200 w-5 text-center">{l.qty}</span>
                          <QtyButton label={t("cart.increase")} onClick={() => setQty(l.id, l.size, l.qty + 1)}>+</QtyButton>
                        </div>
                        <span class="text-sm font-bold text-zinc-100">{l.lineTotal} PLN</span>
                      </div>
                    </div>
                    <button onClick={() => remove(l.id, l.size)} aria-label={t("cart.remove")} class="self-start text-zinc-400 hover:text-red-400 transition-colors text-xs cursor-pointer">{t("cart.remove")}</button>
                  </li>
                )
              })}
            </ul>
          )}
          {lines.length > 0 && (
            <p class="mt-5 text-[11px] uppercase tracking-widest text-amber-400/90 border border-amber-400/30 px-3 py-2 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" stroke-linecap="round" class="w-3 h-3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("cart.freeStickers").replace(/^\+\s*/, "")}
            </p>
          )}
        </div>

        {lines.length > 0 && (
          <div class="border-t border-zinc-800 px-5 py-4 space-y-4">
            {needsShipping && (
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{t("cart.deliveryHeading")}</p>
                {point ? (
                  <div class="flex items-start justify-between gap-3 border border-zinc-800 px-3 py-2">
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-amber-400">{point.code}</p>
                      {point.address && <p class="text-[11px] text-zinc-400 truncate">{point.address}</p>}
                    </div>
                    <button onClick={() => setPickerOpen(true)} class="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-amber-400 whitespace-nowrap cursor-pointer">{t("cart.change")}</button>
                  </div>
                ) : (
                  <button onClick={() => setPickerOpen(true)} class="w-full text-xs font-bold uppercase tracking-widest py-2.5 border border-zinc-700 text-zinc-200 hover:border-amber-400 hover:text-amber-400 transition-colors cursor-pointer">{t("cart.choosePaczkomat")}</button>
                )}
              </div>
            )}

            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{t("cart.billing")}</p>
              <div class="grid grid-cols-2 gap-2">
                <input type="text" value={invoice.name} onInput={setField("name")} placeholder={t("cart.firstName")} autoComplete="given-name" class={inputClass} />
                <input type="text" value={invoice.surname} onInput={setField("surname")} placeholder={t("cart.surname")} autoComplete="family-name" class={inputClass} />
              </div>
              <input type="email" value={invoice.email} onInput={setField("email")} placeholder={t("cart.emailPh")} autoComplete="email" class={`${inputClass} mt-2 w-full`} />
              <input type="text" value={invoice.address} onInput={setField("address")} placeholder={t("cart.addressPh")} autoComplete="street-address" class={`${inputClass} mt-2 w-full`} />
              <div class="grid grid-cols-2 gap-2 mt-2">
                <input type="text" value={invoice.company} onInput={setField("company")} placeholder={t("cart.company")} autoComplete="organization" class={inputClass} />
                <input type="text" value={invoice.nip} onInput={setField("nip")} placeholder={t("cart.nip")} class={inputClass} />
              </div>
            </div>

            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-zinc-400">
                <span class="text-xs uppercase tracking-widest">{t("cart.subtotal")}</span><span>{subtotal} PLN</span>
              </div>
              {needsShipping && (
                <div class="flex justify-between text-zinc-400">
                  <span class="text-xs uppercase tracking-widest">{t("cart.deliveryRow")}</span><span>{shipping} PLN</span>
                </div>
              )}
              <div class="flex justify-between text-zinc-100 font-black pt-2 border-t border-zinc-800 mt-2">
                <span class="text-xs uppercase tracking-widest">{t("cart.total")}</span><span>{total} PLN</span>
              </div>
              <p class="text-[10px] text-zinc-400 pt-1">{t("cart.vatNote")}</p>
            </div>

            {error && <p class="text-[11px] uppercase tracking-widest text-red-400">{error}</p>}

            <button onClick={checkout} disabled={loading} class="w-full bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer uppercase tracking-widest font-bold text-sm py-3 transition-all duration-200">
              {loading ? t("cart.redirecting") : t("cart.pay")}
            </button>
            <p class="text-[10px] text-zinc-400 text-center uppercase tracking-widest">{t("cart.payMethods")}</p>
            <p class="text-[10px] text-zinc-400 text-center leading-relaxed">
              {t("cart.agree")}{" "}
              <a href={lp("/legal/terms")} class="underline underline-offset-2 hover:text-amber-400">{t("cart.agreeTerms")}</a>
              {" "}{t("cart.agreeAnd")}{" "}
              <a href={lp("/legal/returns")} class="underline underline-offset-2 hover:text-amber-400">{t("cart.agreeReturns")}</a>.
            </p>
          </div>
        )}
      </aside>
      <InpostGeowidget open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setPoint} />
    </>
  )
}

export default CartDrawer
