import { useState, useEffect, lazy, Suspense } from "preact/compat"
import { LanguageProvider, useI18n } from "../../../i18n/I18nContext"
import { CartProvider, useCart } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import ProductCard from "./productCard"
import { PRODUCTS, BUNDLES, discountActive, discountEndsLabel } from "../../../data/products"

const CartDrawer = lazy(() => import("./cartDrawer"))

const CartFab = () => {
  const { count, setOpen } = useCart()
  const { t, lang } = useI18n()
  if (count === 0) return null
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label={`${t("cart.open")} (${count})`}
      class="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-black px-5 py-3 shadow-xl transition-colors cursor-pointer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="w-6 h-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span class="text-xs font-bold uppercase tracking-widest">
        {lang === "pl" ? "koszyk" : "cart"} | {count}
      </span>
    </button>
  )
}

const MerchInner = () => {
  const { t, lang, lp } = useI18n()
  const images = useMerchImages()
  const [isWide, setIsWide] = useState(true)
  const saleActive = discountActive()

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => setIsWide(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  const saleLabel = saleActive ? discountEndsLabel(lang === "pl" ? "pl-PL" : "en-GB") : null

  return (
    <div class="bg-zinc-950 min-h-screen">
      <main id="main-content" class="pt-20">
        <div class="px-6 lg:px-12 py-12 max-w-7xl mx-auto">
          <div class="mb-10">
            <p class="text-xs font-bold uppercase tracking-[0.4em] text-amber-400 mb-3">
              {t("merch.eyebrow")}
            </p>
            <h1 class="text-4xl lg:text-5xl font-black uppercase tracking-tight text-white">
              {t("merch.title")}
            </h1>
            {saleActive && saleLabel && (
              <p class="mt-3 inline-block text-[11px] font-bold uppercase tracking-widest text-black bg-amber-400 px-3 py-1.5">
                {t("merch.saleBanner", saleLabel)}
              </p>
            )}
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {PRODUCTS.map((product, i) => (
              <ProductCard key={product.id} product={product} images={images} index={i} isWide={isWide} />
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
              <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {BUNDLES.map((product, i) => (
                  <ProductCard key={product.id} product={product} images={images} index={PRODUCTS.length + i} isWide={isWide} />
                ))}
              </div>
            </div>
          )}

          <div class="border-t border-zinc-800/60 pt-10">
            <dl class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              {[
                { q: t("merch.delivery"), a: t("merch.deliveryText") },
                { q: t("merch.payments"), a: t("merch.paymentsText") },
                { q: t("merch.freeStickers"), a: t("merch.freeStickersText") },
              ].map(({ q, a }) => (
                <div key={q} class="border border-zinc-800/60 p-4">
                  <dt class="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">{q}</dt>
                  <dd class="text-xs text-zinc-400 leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
            <div class="flex flex-wrap gap-4 mt-6 text-[10px] uppercase tracking-widest text-zinc-400">
              <a href={lp("/legal/terms")} class="hover:text-amber-400 transition-colors">{t("merch.termsLink")}</a>
              <a href={lp("/legal/returns")} class="hover:text-amber-400 transition-colors">{t("merch.returnsLink")}</a>
              <a href={lp("/legal/privacy")} class="hover:text-amber-400 transition-colors">{t("merch.privacyLink")}</a>
            </div>
          </div>
        </div>
      </main>

      <CartFab />
      <Suspense fallback={null}>
        <CartDrawer />
      </Suspense>
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
