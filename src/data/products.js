export const CURRENCY = "pln"
export const SHIPPING_PLN = 15
export const SIZES = ["S", "M", "L", "XL", "XXL"]

// VAT applied to all goods. Delivery is shipped outside of tax (flat fee).
export const VAT_RATE = 0.23

// Site-wide promo. Prices shown and charged are the discounted gross.
export const DISCOUNT_RATE = 0.2
// Time window for the promo. Both bounds are optional ISO strings:
//   DISCOUNT_FROM  — promo starts (leave null to be already active)
//   DISCOUNT_UNTIL — promo ends   (leave null to run forever)
// To make the discount time-limited, set a date, e.g.:
//   export const DISCOUNT_UNTIL = "2026-07-01T23:59:59+02:00"
export const DISCOUNT_FROM = null
export const DISCOUNT_UNTIL = "2028-01-01T00:00:00+01:00"

// Whether the discount is live right now (rate > 0 and inside the window).
export const discountActive = (now = new Date()) => {
  if (!(DISCOUNT_RATE > 0)) return false
  if (DISCOUNT_FROM && now < new Date(DISCOUNT_FROM)) return false
  if (DISCOUNT_UNTIL && now > new Date(DISCOUNT_UNTIL)) return false
  return true
}

// Stock model:
//  - sized products carry `inStockSizes` — sizes not listed are sold out
//    (rendered greyed-out; clicking one notifies the crew of demand).
//  - non-sized products carry `inStock`.
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

export const getProduct = id => PRODUCTS.find(p => p.id === id)

export const productRequiresShipping = product =>
  !!product && product.requiresShipping !== false

// Price (PLN) the customer sees and the amount we charge — the server
// recomputes it, never trusting the client. Falls back to full price when the
// promo window is closed.
export const discountedPrice = product => {
  if (!product) return 0
  if (!discountActive()) return product.price
  return Math.round(product.price * (1 - DISCOUNT_RATE))
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
