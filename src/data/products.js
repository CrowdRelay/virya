export const CURRENCY = "pln"
export const SHIPPING_PLN = 15
export const SIZES = ["S", "M", "L", "XL", "XXL"]

// VAT applied to all goods. Delivery is shipped outside of tax (flat fee).
export const VAT_RATE = 0.23

// Site-wide promo. Prices shown and charged are the discounted gross.
export const DISCOUNT_RATE = 0.2
// Bundles get a deeper cut to reward buying the pack.
export const BUNDLE_DISCOUNT_RATE = 0.3
// Time window for the promo. Both bounds are optional ISO strings:
//   DISCOUNT_FROM  — promo starts (leave null to be already active)
//   DISCOUNT_UNTIL — promo ends   (leave null to run forever)
// To make the discount time-limited, set a date, e.g.:
//   export const DISCOUNT_UNTIL = "2026-07-01T23:59:59+02:00"
export const DISCOUNT_FROM = null
export const DISCOUNT_UNTIL = "2026-12-31T23:59:59+01:00"

// Whether the discount is live right now (rate > 0 and inside the window).
export const discountActive = (now = new Date()) => {
  if (!(DISCOUNT_RATE > 0)) return false
  if (DISCOUNT_FROM && now < new Date(DISCOUNT_FROM)) return false
  if (DISCOUNT_UNTIL && now > new Date(DISCOUNT_UNTIL)) return false
  return true
}

// End of the promo window as a Date (or null if open-ended).
export const discountEndsAt = () => (DISCOUNT_UNTIL ? new Date(DISCOUNT_UNTIL) : null)

// Human-friendly end date, e.g. "31 December 2026" — null when not applicable.
export const discountEndsLabel = (locale = "en-GB") => {
  const d = discountEndsAt()
  if (!d || !discountActive()) return null
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Stock model:
//  - sized products carry `inStockSizes` — sizes not listed are sold out
//    (rendered greyed-out; clicking one notifies the crew of demand).
//  - non-sized products carry `inStock`.
//  - low-stock hints: `lowStock: true` flags a thin product; `lowStockSizes`
//    flags individual sizes that are in stock but running low. These only
//    drive a "running low" nudge in the UI — they never block a purchase.
export const PRODUCTS = [
  {
    id: "echoes",
    name: "Echoes Of The Modern Mind",
    type: "album",
    price: 50,
    front: "merch/echoes.webp",
    back: null,
    sizes: null,
    inStock: true,
    blurb:
      "Our debut full-length — 11 tracks through the broad mind of a modern man. Every piece is signed by the band.",
  },
  {
    id: "ashes-color",
    name: "From The Ashes — Colour Tee",
    type: "shirt",
    price: 70,
    front: "merch/Ashes Color Front.webp",
    back: "merch/ashes and wave back.webp",
    sizes: SIZES,
    inStockSizes: ["M"],
    lowStock: true,
    lowStockSizes: ["M"],
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
    inStockSizes: ["M", "L"],
    lowStockSizes: ["L"],
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
    inStockSizes: ["M", "L", "XL"],
    lowStockSizes: ["XL"],
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
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
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
    inStock: true,
    blurb: "Heavy-duty tote with the Virya crest. Carry the catharsis.",
  },
]

// Bundles — two items sold together for less than buying them apart. They are
// first-class products (own id, price, stock) so checkout/cart treat them like
// anything else; `includes` is purely for display. Sized bundles inherit the
// tee's available sizes via `inStockSizes`.
export const BUNDLES = [
  {
    id: "bundle-stage-pack",
    name: "Stage Pack",
    type: "bundle",
    bundle: true,
    price: 100,
    front: "merch/virya shirt 1.webp",
    back: "merch/echoes.webp",
    sizes: SIZES,
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
    includes: ["Virya Logo Tee", "Echoes — CD album"],
    blurb: "The logo tee and our debut album together — cheaper than apart.",
  },
  {
    id: "bundle-catharsis-pack",
    name: "Catharsis Pack",
    type: "bundle",
    bundle: true,
    price: 90,
    front: "merch/Bag 1.webp",
    back: "merch/echoes.webp",
    sizes: null,
    inStock: true,
    includes: ["Virya Tote Bag", "Echoes — CD album"],
    blurb: "Carry the catharsis: the tote plus the debut album in one pack.",
  },
  {
    id: "bundle-stay-mad-pack",
    name: "Stay Mad Pack",
    type: "bundle",
    bundle: true,
    price: 100,
    front: "merch/virya shirt 1.webp",
    back: "merch/Bag 1.webp",
    sizes: SIZES,
    inStockSizes: ["S", "L", "XXL"],
    lowStockSizes: ["XXL"],
    includes: ["Virya Logo Tee", "Virya Tote Bag"],
    blurb: "The logo tee and tote together — wear it, carry it, Stay Mad.",
  },
]

// Everything purchasable, used by cart/checkout lookups.
export const ALL_PRODUCTS = [...PRODUCTS, ...BUNDLES]

export const getProduct = id => ALL_PRODUCTS.find(p => p.id === id)

export const isBundle = product => !!product && product.bundle === true

// The discount rate that applies to a given product (bundles get more off).
export const discountRate = product =>
  isBundle(product) ? BUNDLE_DISCOUNT_RATE : DISCOUNT_RATE

// Whole-percent discount for display (0 when the promo window is closed).
export const discountPct = product =>
  discountActive() ? Math.round(discountRate(product) * 100) : 0

// Whether a product is flagged as running low (drives a soft "low stock" nudge).
export const productLowStock = product =>
  !!product && product.lowStock === true && productInStock(product)

// Whether a specific (in-stock) size is running low.
export const sizeLowStock = (product, size) =>
  !!product &&
  Array.isArray(product.lowStockSizes) &&
  product.lowStockSizes.includes(size) &&
  sizeInStock(product, size)

export const productRequiresShipping = product =>
  !!product && product.requiresShipping !== false

// Price (PLN) the customer sees and the amount we charge — the server
// recomputes it, never trusting the client. Falls back to full price when the
// promo window is closed.
export const discountedPrice = product => {
  if (!product) return 0
  if (!discountActive()) return product.price
  return Math.round(product.price * (1 - discountRate(product)))
}

export const sizeInStock = (product, size) => {
  if (!product || !Array.isArray(product.inStockSizes)) return true
  return product.inStockSizes.includes(size)
}

export const productInStock = product => {
  if (!product) return false
  if (Array.isArray(product.sizes)) {
    return (
      Array.isArray(product.inStockSizes) && product.inStockSizes.length > 0
    )
  }
  return product.inStock !== false
}

// Split a gross amount (PLN) into net + VAT at the given rate.
export const vatBreakdown = (gross, rate = VAT_RATE) => {
  const net = gross / (1 + rate)
  return { gross, net, vat: gross - net }
}

export const toMinorUnits = pln => Math.round(pln * 100)
