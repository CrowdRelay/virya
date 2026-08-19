import { useState, useEffect, lazy, Suspense } from "preact/compat"
import { LanguageProvider, useI18n } from "../../../i18n/I18nContext"
import { CartProvider, useCart } from "./cartContext"
import { useCartActions } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import ProductCard from "./productCard"
import { PRODUCTS, BUNDLES, discountActive, discountEndsLabel } from "../../../data/products"

const CartDrawer = lazy(() => import("./cartDrawer"))

const CartFab = () => {
  const { count, total, setOpen } = useCart()
  const { t, lang } = useI18n()
  if (count === 0) return null
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label={`${t("cart.open")} (${count})`}
      class="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center justify-between gap-4 bg-amber-400 px-5 text-black shadow-[0_18px_60px_rgba(0,0,0,.45)] transition-colors hover:bg-amber-300 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-start"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span class="text-[11px] font-black uppercase tracking-[.14em]">
        {lang === "pl" ? "koszyk" : "cart"} · {count}
      </span>
      <span class="text-sm font-black tabular-nums sm:hidden">{total.toFixed(0)} PLN →</span>
    </button>
  )
}

const CartDrawerFallback = () => (
  <div class="fixed inset-0 z-40 flex items-center justify-end bg-black/40" role="status" aria-live="polite">
    <div class="flex h-full w-full max-w-md items-center justify-center border-l border-zinc-800 bg-zinc-950">
      <span class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" aria-hidden="true" />
    </div>
  </div>
)

const MerchInner = () => {
  const { t, lang, lp } = useI18n()
  const { open: cartOpen, count: cartCount } = useCart()
  const { setPriceOverrides } = useCartActions()
  const images = useMerchImages()
  const [inventory, setInventory] = useState({
    status: "loading",
    variants: null,
    prices: {},
  })
  const saleActive = discountActive()

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 3500)
    fetch("/api/merch/inventory", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`inventory ${response.status}`)
        return response.json()
      })
      .then(payload => {
        if (payload?.status !== "ready" || !payload.variants) {
          throw new Error("invalid inventory payload")
        }
        if (active) {
          const prices = payload.prices && typeof payload.prices === "object" ? payload.prices : {}
          setPriceOverrides(prices)
          setInventory({ status: "ready", variants: payload.variants, prices })
        }
      })
      .catch(() => {
        if (active) {
          setPriceOverrides({})
          setInventory({ status: "unavailable", variants: null, prices: {} })
        }
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [setPriceOverrides])
  useEffect(() => {
    const product = new URLSearchParams(window.location.search).get("product")
    if (!product || !/^[a-z0-9_-]{1,128}$/.test(product)) return
    let focusTimer
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`merch-${product}`)
      if (!card) return
      card.scrollIntoView({ behavior: "smooth", block: "center" })
      focusTimer = window.setTimeout(() => {
        if (card.isConnected) card.focus({ preventScroll: true })
      }, 450)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (focusTimer !== undefined) window.clearTimeout(focusTimer)
    }
  }, [])
  const saleLabel = saleActive ? discountEndsLabel(lang === "pl" ? "pl-PL" : "en-GB") : null

  return (
    <div class="bg-zinc-950 min-h-screen">
      <main id="main-content" class="pt-20">
        <div class="virya-container py-10 sm:py-14 lg:py-16">
          <div class="mb-10 sm:mb-12">
            <p class="virya-eyebrow mb-3">
              {t("merch.eyebrow")}
            </p>
            <h1 class="virya-heading">
              {t("merch.title")}
            </h1>
            {saleActive && saleLabel && (
              <p class="mt-3 inline-block text-[11px] font-bold uppercase tracking-widest text-black bg-amber-400 px-3 py-1.5">
                {t("merch.saleBanner", saleLabel)}
              </p>
            )}
          </div>

          <div class="mb-16 grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {PRODUCTS.map((product, i) => (
              <ProductCard key={product.id} product={product} images={images} index={i} inventory={inventory} />
            ))}
          </div>

          {BUNDLES.length > 0 && (
            <div class="mb-16">
              <div class="mb-8 border-t border-zinc-800/60 pt-8">
                <h2 class="text-2xl font-black uppercase tracking-tight text-white mb-1">
                  {t("merch.bundles")}
                </h2>
                <p class="text-sm text-zinc-400">{t("merch.bundlesSub")}</p>
              </div>
              <div class="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 lg:gap-7">
                {BUNDLES.map((product, i) => (
                  <ProductCard key={product.id} product={product} images={images} index={PRODUCTS.length + i} inventory={inventory} />
                ))}
              </div>
            </div>
          )}


          <aside class="mb-16 grid gap-5 border-y border-amber-400/25 bg-amber-400/[.035] px-5 py-7 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7">
            <div>
              <p class="virya-eyebrow">{t("merch.areaBanner")}</p>
              <p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{t("merch.areaBannerBody")}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <a href={lp("/signal/")} class="virya-button virya-button--primary">
                {t("merch.signalBannerCta")} <span class="ml-2" aria-hidden="true">→</span>
              </a>
              <a href={lp("/area/")} class="virya-button virya-button--secondary">{t("merch.areaBannerCta")}</a>
            </div>
          </aside>

          <div class="border-t border-zinc-800/60 pt-10">
            <dl class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              {[
                { q: t("merch.delivery"), a: t("merch.deliveryText") },
                { q: t("merch.payments"), a: t("merch.paymentsText") },
                { q: t("merch.freeStickers"), a: t("merch.freeStickersText") },
              ].map(({ q, a }) => (
                <div key={q} class="border border-zinc-800/60 p-4">
                  <dt class="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-2">{q}</dt>
                  <dd class="text-xs text-zinc-400 leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
            <div class="flex flex-wrap gap-4 mt-6 text-[11px] uppercase tracking-widest text-zinc-400">
              <a href={lp("/legal/terms")} class="hover:text-amber-400 transition-colors">{t("merch.termsLink")}</a>
              <a href={lp("/legal/returns")} class="hover:text-amber-400 transition-colors">{t("merch.returnsLink")}</a>
              <a href={lp("/legal/privacy")} class="hover:text-amber-400 transition-colors">{t("merch.privacyLink")}</a>
            </div>
          </div>
        </div>
      </main>

      <CartFab />
      {(cartOpen || cartCount > 0) && (
        <Suspense fallback={<CartDrawerFallback />}>
          <CartDrawer />
        </Suspense>
      )}
    </div>
  )
}

const MerchClient = ({ lang }) => (
  <LanguageProvider initialLang={lang}>
    <CartProvider>
      <MerchInner />
    </CartProvider>
  </LanguageProvider>
)

export default MerchClient
