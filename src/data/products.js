// Single source of truth for the merch catalog.
// Imported by the storefront UI (display) AND the Stripe Functions (authoritative
// pricing). The client only ever sends { id, size, qty } — the server recomputes
// every amount from this file, so prices can never be tampered with from the browser.
//
// Prices are in PLN (whole złoty). Edit them here; nothing else needs to change.
// BLIK require PLN, so keep the currency as "pln".

export const CURRENCY = "pln"

// Flat InPost Paczkomat delivery fee (PLN). Shown at checkout and charged via Stripe.
export const SHIPPING_PLN = 15

export const SIZES = ["S", "M", "L", "XL", "XXL"]

// `front` / `back` are relativePaths under src/images/ (the "img" filesystem source),
// matched in the UI via the same useStaticQuery pattern as the portfolio.
export const PRODUCTS = [
  {
    id: "echoes",
    name: "Echoes Of The Modern Mind",
    type: "album",
    price: 50,
    front: "merch/echoes.webp",
    back: null,
    sizes: null,
    blurb:
      "Our debut full-length — 11 tracks through the broad mind of a modern man.",
  },
  {
    id: "ashes-color",
    name: "From The Ashes — Colour Tee",
    type: "shirt",
    price: 70,
    front: "merch/Ashes Color Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. The phoenix rises in full colour.",
  },
  {
    id: "ashes-bw",
    name: "From The Ashes — Mono Tee",
    type: "shirt",
    price: 70,
    front: "merch/Ashes BW Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. The phoenix, rendered in monochrome.",
  },
  {
    id: "wave",
    name: "Wave Of Uncertainty Tee",
    type: "shirt",
    price: 70,
    front: "merch/Wave Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    blurb: "All-over print. Ride the wave of uncertainty.",
  },
  {
    id: "virya-logo",
    name: "Virya Logo Tee",
    type: "shirt",
    price: 60,
    front: "merch/virya shirt 1.webp",
    back: "merch/virya shirt front.webp",
    sizes: SIZES,
    blurb: "Clean silver crest on the front, gold emblem on the back.",
  },
  {
    id: "bag",
    name: "Virya Tote Bag",
    type: "bag",
    price: 50,
    front: "merch/Bag 1.webp",
    back: "merch/Bag 2.webp",
    sizes: null,
    blurb: "Heavy-duty tote with the Virya crest. Carry the catharsis.",
  },
]

export const getProduct = id => PRODUCTS.find(p => p.id === id)

// Physical goods need InPost delivery; digital/test items don't.
export const productRequiresShipping = product =>
  !!product && product.requiresShipping !== false

// Stripe expects the amount in the smallest currency unit (grosze).
export const toMinorUnits = pln => Math.round(pln * 100)
