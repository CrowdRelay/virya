import { useState, useCallback, useRef, useEffect } from "preact/hooks"
import { useCart, lineKey } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import { useI18n } from "../../../i18n/I18nContext"
import InpostGeowidget from "./inpostGeowidget"
import { isAreaRewardEligible } from "../../../data/products"

const inputClass =
  "bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors"

const CHECKOUT_REQUEST_KEY = "virya-checkout-request"
const REWARD_CODE_KEY = "virya-area-reward-code"

const readSessionValue = (key) => {
  if (typeof window === "undefined") return ""
  try {
    return sessionStorage.getItem(key) || ""
  } catch {
    return ""
  }
}

const clearRewardCheckout = () => {
  try {
    sessionStorage.removeItem(CHECKOUT_REQUEST_KEY)
  } catch {}
}

const PlusIcon = ({ class: cls }) => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" class={cls}>
    <path d="M8 1.5v13M1.5 8h13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
)

const MinusIcon = ({ class: cls }) => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" class={cls}>
    <path d="M1.5 8h13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
)

const QtyButton = ({ children, onClick, label }) => (
  <button onClick={onClick} aria-label={label}
    class="group w-7 h-7 flex items-center justify-center border border-zinc-700 hover:border-amber-400 transition-colors cursor-pointer">
    <span class="flex items-center justify-center text-zinc-300 group-hover:text-amber-400">
      {children}
    </span>
  </button>
)

const CartDrawer = () => {
  const { t, lang, lp } = useI18n()
  const getProductName = (product) => lang === "pl" && product.name_pl ? product.name_pl : product.name
  const { lines, open, setOpen, subtotal, shipping, needsShipping, total, setQty, remove, hydrated } = useCart()
  const images = useMerchImages()
  const [point, setPoint] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const drawerRef = useRef(null)
  const returnFocusRef = useRef(null)
  const [invoice, setInvoice] = useState({ name: "", surname: "", email: "", address: "", nip: "", company: "" })
  const [rewardCode, setRewardCode] = useState(() => readSessionValue(REWARD_CODE_KEY))
  const [rewardApplied, setRewardApplied] = useState(false)
  const [rewardChecking, setRewardChecking] = useState(false)
  const previousCartSignature = useRef(null)

  const rewardEntry = rewardApplied && lines.length
    ? lines.reduce(
        (best, line) =>
          isAreaRewardEligible(line.product) &&
          (!best || line.unitPrice > best.unitPrice)
            ? line
            : best,
        null,
      )
    : null
  const rewardItemDiscount = rewardEntry?.unitPrice || 0
  const rewardShippingDiscount = rewardApplied ? shipping : 0
  const rewardedTotal = Math.max(0, total - rewardItemDiscount - rewardShippingDiscount)

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

  useEffect(() => {
    if (!open || !drawerRef.current) return
    const drawer = drawerRef.current
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const close = drawer.querySelector("[data-cart-close]")
    requestAnimationFrame(() => close?.focus())
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const items = Array.from(drawer.querySelectorAll(focusableSelector)).filter((item) => item.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    drawer.addEventListener("keydown", onKeyDown)
    return () => {
      drawer.removeEventListener("keydown", onKeyDown)
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
    }
  }, [open, setOpen])

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

  const cartSignature = lines
    .map((line) => `${line.id}:${line.size}:${line.qty}`)
    .sort()
    .join("|")

  useEffect(() => {
    if (!hydrated) return
    if (previousCartSignature.current === null) {
      previousCartSignature.current = cartSignature
      return
    }
    if (previousCartSignature.current !== cartSignature) {
      previousCartSignature.current = cartSignature
      clearRewardCheckout()
    }
  }, [cartSignature, hydrated])

  const updateRewardCode = useCallback((e) => {
    setRewardCode(e.target.value.toUpperCase())
    setRewardApplied(false)
    clearRewardCheckout()
    try {
      sessionStorage.removeItem(REWARD_CODE_KEY)
    } catch {}
    setError("")
  }, [])

  const applyReward = useCallback(async () => {
    const code = rewardCode.trim().toUpperCase()
    if (!code) { setError(t("cart.rewardEnter")); return }
    setRewardChecking(true)
    setError("")
    try {
      const response = await fetch("/api/area/reward/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          code,
          checkoutRequestId:
            sessionStorage.getItem(CHECKOUT_REQUEST_KEY) || "",
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || t("cart.rewardInvalid"))
      const normalizedCode = data.code || code
      setRewardCode(normalizedCode)
      setRewardApplied(true)
      try {
        sessionStorage.setItem(REWARD_CODE_KEY, normalizedCode)
      } catch {}
    } catch (e) {
      setRewardApplied(false)
      try {
        sessionStorage.removeItem(REWARD_CODE_KEY)
      } catch {}
      clearRewardCheckout()
      setError(e.message || t("cart.rewardInvalid"))
    } finally {
      setRewardChecking(false)
    }
  }, [rewardCode, t])

  useEffect(() => {
    if (rewardCode.trim()) void applyReward()
    // Restore a cancelled/reloaded reward checkout once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkout = useCallback(async () => {
    setError("")
    const name = invoice.name.trim(); const surname = invoice.surname.trim()
    const email = invoice.email.trim(); const address = invoice.address.trim()
    if (!name || !surname || !email || !address) { setError(t("cart.errFill")); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t("cart.errEmail")); return }
    if (needsShipping && !point) { setError(t("cart.errPaczkomat")); return }
    if (rewardCode.trim() && !rewardApplied) { setError(t("cart.rewardApplyFirst")); return }
    setLoading(true)
    try {
      const checkoutRequestId = rewardApplied
        ? sessionStorage.getItem(CHECKOUT_REQUEST_KEY) || crypto.randomUUID()
        : ""
      if (rewardApplied) sessionStorage.setItem(CHECKOUT_REQUEST_KEY, checkoutRequestId)
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          items: lines.map((l) => ({ id: l.id, size: l.size, qty: l.qty })),
          point: needsShipping ? point : null,
          invoice: { name, surname, email, address, nip: invoice.nip.trim(), company: invoice.company.trim() },
          rewardCode: rewardApplied ? rewardCode.trim().toUpperCase() : "",
          checkoutRequestId,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        if (!data.retrySameRequest) clearRewardCheckout()
        throw new Error(data.error || "Checkout failed")
      }
      // Keep the request id and reward code until the success page. If the
      // player cancels Stripe Checkout, the same reservation can resume.
      window.location.href = data.url
    } catch (e) { setError(e.message || t("cart.errGeneric")); setLoading(false) }
  }, [lines, point, needsShipping, invoice, t, lang, rewardCode, rewardApplied])

  return (
    <>
      <div class={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        ref={drawerRef}
        class={`fixed top-0 right-0 z-40 h-[var(--cart-h,100dvh)] w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col ${isDragging ? "" : "transition-transform duration-300"} ${open ? "translate-x-0" : "translate-x-full"}`}
        style={dragX > 0 ? { transform: `translateX(${dragX}px)` } : undefined}
        aria-label={t("cart.title")}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-hidden={open ? undefined : "true"}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 class="text-sm font-black uppercase tracking-widest text-zinc-100">{t("cart.title")}</h2>
          <button data-cart-close onClick={() => setOpen(false)} aria-label={t("cart.close")} class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none cursor-pointer">&times;</button>
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
                          <QtyButton label={t("cart.decrease")} onClick={() => setQty(l.id, l.size, l.qty - 1)}><MinusIcon /></QtyButton>
                          <span class="text-sm text-zinc-200 w-5 text-center">{l.qty}</span>
                          <QtyButton label={t("cart.increase")} onClick={() => setQty(l.id, l.size, l.qty + 1)}><PlusIcon /></QtyButton>
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
            <p class="mt-5 text-[11px] uppercase tracking-widest text-amber-400/90 border border-amber-400/30 px-3 py-2 flex items-center gap-1.5">
              <PlusIcon class="flex-shrink-0" />
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

            <div class="border border-amber-400/25 bg-amber-400/[.04] p-3">
              <p class="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">{t("cart.rewardHeading")}</p>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={rewardCode}
                  onInput={updateRewardCode}
                  placeholder={t("cart.rewardPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  class={`${inputClass} min-w-0 flex-1 uppercase tracking-wider`}
                />
                <button
                  type="button"
                  onClick={applyReward}
                  disabled={rewardChecking || !rewardCode.trim()}
                  class="shrink-0 border border-amber-400 px-3 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40"
                >
                  {rewardChecking ? t("cart.rewardChecking") : t("cart.rewardApply")}
                </button>
              </div>
              {rewardApplied && rewardEntry && (
                <p class="mt-2 text-[10px] leading-relaxed text-amber-300">
                  {t("cart.rewardApplied", getProductName(rewardEntry.product))}
                </p>
              )}
            </div>

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
              {rewardApplied && rewardEntry && (
                <div class="flex justify-between text-amber-400">
                  <span class="text-xs uppercase tracking-widest">{t("cart.rewardItemRow")}</span><span>−{rewardItemDiscount} PLN</span>
                </div>
              )}
              {needsShipping && (
                <div class="flex justify-between text-zinc-400">
                  <span class="text-xs uppercase tracking-widest">{t("cart.deliveryRow")}</span>
                  <span class={rewardApplied ? "line-through opacity-60" : ""}>{shipping} PLN</span>
                </div>
              )}
              {rewardApplied && needsShipping && (
                <div class="flex justify-between text-amber-400">
                  <span class="text-xs uppercase tracking-widest">{t("cart.rewardDeliveryRow")}</span><span>−{rewardShippingDiscount} PLN</span>
                </div>
              )}
              <div class="flex justify-between text-zinc-100 font-black pt-2 border-t border-zinc-800 mt-2">
                <span class="text-xs uppercase tracking-widest">{t("cart.total")}</span><span>{rewardApplied ? rewardedTotal : total} PLN</span>
              </div>
              <p class="text-[10px] text-zinc-400 pt-1">{t("cart.vatNote")}</p>
            </div>

            {error && <p class="text-[11px] uppercase tracking-widest text-red-400">{error}</p>}

            <button onClick={checkout} disabled={loading} class="w-full bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer uppercase tracking-widest font-bold text-sm py-3 transition-all duration-200">
              {loading ? t("cart.redirecting") : rewardApplied && rewardedTotal === 0 ? t("cart.claimFreeOrder") : t("cart.pay")}
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
