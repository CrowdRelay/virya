"use client"
import React from "react"
import { Link } from "gatsby"
import Navbar from "../nav"
import Footer from "../footer"
import { ScrollToTop } from "../scrollToTop/scroll"
import { PRODUCTS } from "../../data/products"
import { CartProvider, useCart } from "./cartContext"
import { useMerchImages } from "./useMerchImages"
import ProductCard from "./productCard"
import CartDrawer from "./cartDrawer"

const CartFab = () => {
  const { count, setOpen } = useCart()
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Open cart"
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-amber-400 text-black hover:bg-amber-300 transition-colors shadow-lg shadow-black/40 px-5 py-3 uppercase tracking-widest text-xs font-bold"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17M17 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 21a2 2 0 1 1-4 0"
        />
      </svg>
      <span>Cart</span>
      {count > 0 && (
        <span className="bg-black text-amber-400 rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[11px] font-black">
          {count}
        </span>
      )}
    </button>
  )
}

const Storefront = () => {
  const images = useMerchImages()
  return (
    <div className="bg-zinc-950 min-h-screen">
      <header className="header relative lg:overflow-hidden">
        <Navbar displayLinks={false} />
      </header>
      {/* Lifted above the cart button so they don't overlap. */}
      <ScrollToTop smooth positionClassName="right-6 bottom-24" />

      <main className="pt-20 lg:container lg:mx-auto">
        <div className="px-6 lg:px-12 py-12">
          {/* Title row */}
          <div className="flex items-center gap-6 mb-4 border-b border-zinc-800/60 pb-8">
            <Link
              title="Homepage"
              to="/"
              className="text-zinc-400 hover:text-amber-400 transition-colors text-2xl leading-none"
            >
              &larr;
            </Link>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-3xl font-black uppercase tracking-widest whitespace-nowrap text-zinc-100">
                Merch
              </h1>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>

          <p className="uppercase tracking-[0.3em] text-amber-400 text-xs font-bold mb-12">
            Official store · Free stickers with every order
          </p>

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRODUCTS.map(product => (
              <ProductCard key={product.id} product={product} images={images} />
            ))}
          </div>

          {/* Shipping/payment note */}
          <div className="mt-16 grid gap-6 lg:grid-cols-3 text-zinc-400">
            {[
              [
                "Delivery",
                "Shipped to your chosen InPost Paczkomat across Poland.",
              ],
              [
                "Payments",
                "BLIK, Google Pay, Revolut Pay and cards — securely via Stripe.",
              ],
              [
                "Free stickers",
                "Every order ships with a set of Virya stickers. On us.",
              ],
            ].map(([title, text]) => (
              <div
                key={title}
                className="border-l-2 border-amber-400/30 pl-4 py-2"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                  {title}
                </p>
                <p className="text-xs leading-relaxed mt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <Footer />
      </main>

      <CartFab />
      <CartDrawer />
    </div>
  )
}

const MerchClient = () => (
  <CartProvider>
    <Storefront />
  </CartProvider>
)

export default MerchClient
